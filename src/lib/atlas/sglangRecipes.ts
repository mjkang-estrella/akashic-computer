import { parse } from "acorn";
import { parse as parseYaml } from "yaml";
import { stableHash, type ParsedDeploymentRecipe } from "./intelligence";

type AstNode = Record<string, unknown> & { type: string };

function node(value: unknown): AstNode | null {
  return value && typeof value === "object" && "type" in value
    ? value as AstNode
    : null;
}

function propertyName(property: AstNode): string | null {
  const key = node(property.key);
  if (!key) return null;
  if (key.type === "Identifier" && typeof key.name === "string") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

function property(object: AstNode | null, name: string): AstNode | null {
  if (!object || object.type !== "ObjectExpression" || !Array.isArray(object.properties)) return null;
  for (const rawProperty of object.properties) {
    const candidate = node(rawProperty);
    if (!candidate || candidate.type !== "Property" || propertyName(candidate) !== name) continue;
    return node(candidate.value);
  }
  return null;
}

function stringValue(value: AstNode | null): string | null {
  return value?.type === "Literal" && typeof value.value === "string" ? value.value : null;
}

function booleanValue(value: AstNode | null): boolean | null {
  return value?.type === "Literal" && typeof value.value === "boolean" ? value.value : null;
}

function arrayNodes(value: AstNode | null): AstNode[] {
  if (!value || value.type !== "ArrayExpression" || !Array.isArray(value.elements)) return [];
  return value.elements.flatMap((entry) => {
    const parsed = node(entry);
    return parsed ? [parsed] : [];
  });
}

function stringArray(value: AstNode | null): string[] {
  return arrayNodes(value).flatMap((entry) => {
    const parsed = stringValue(entry);
    return parsed ? [parsed] : [];
  });
}

function stringObject(value: AstNode | null): Array<{ key: string; value: string }> {
  if (!value || value.type !== "ObjectExpression" || !Array.isArray(value.properties)) return [];
  return value.properties.flatMap((rawProperty) => {
    const candidate = node(rawProperty);
    if (!candidate || candidate.type !== "Property") return [];
    const key = propertyName(candidate);
    const parsed = stringValue(node(candidate.value));
    return key && parsed ? [{ key, value: parsed }] : [];
  });
}

function options(value: AstNode | null): Array<{ id: string; label: string }> {
  return arrayNodes(value).flatMap((entry) => {
    const id = stringValue(property(entry, "id"));
    const label = stringValue(property(entry, "label"));
    return id ? [{ id, label: label ?? id.toUpperCase() }] : [];
  });
}

function configObject(source: string): AstNode | null {
  const program = parse(source, { ecmaVersion: "latest", sourceType: "module" }) as unknown as AstNode;
  const body = Array.isArray(program.body) ? program.body : [];
  for (const rawStatement of body) {
    const statement = node(rawStatement);
    if (!statement || statement.type !== "ExportNamedDeclaration") continue;
    const declaration = node(statement.declaration);
    if (!declaration || declaration.type !== "VariableDeclaration" || !Array.isArray(declaration.declarations)) continue;
    for (const rawVariable of declaration.declarations) {
      const variable = node(rawVariable);
      const id = node(variable?.id);
      if (id?.type === "Identifier" && id.name === "config") return node(variable?.init);
    }
  }
  return null;
}

function frontmatter(source: string): { title?: string; description?: string } {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const parsed = parseYaml(match[1]);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const record = parsed as Record<string, unknown>;
  return {
    title: typeof record.title === "string" ? record.title : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
  };
}

function hardwareLabel(id: string): string {
  const known: Record<string, string> = {
    h100: "NVIDIA H100",
    h200: "NVIDIA H200",
    b200: "NVIDIA B200",
    b300: "NVIDIA B300",
    gb200: "NVIDIA GB200",
    gb300: "NVIDIA GB300",
    mi300x: "AMD MI300X",
    mi325x: "AMD MI325X",
    mi350x: "AMD MI350X",
    mi355x: "AMD MI355X",
    rtx5090: "NVIDIA RTX 5090",
  };
  return known[id] ?? id.replaceAll("_", " ").toUpperCase();
}

function collectVerifiedHardware(config: AstNode): Set<string> {
  const verified = new Set<string>();
  for (const cell of arrayNodes(property(config, "cells"))) {
    if (booleanValue(property(cell, "verified")) !== true) continue;
    const hardware = stringValue(property(property(cell, "match"), "hw"));
    if (hardware) verified.add(hardware);
  }
  return verified;
}

function quantizationOptions(config: AstNode): Array<{ id: string; label: string }> {
  const direct = options(property(config, "quantizations"));
  if (direct.length > 0) return direct;
  for (const dimension of arrayNodes(property(config, "matchDims"))) {
    if (stringValue(property(dimension, "id")) === "quant") return options(property(dimension, "options"));
  }
  return [];
}

export function parseSglangRecipe(args: {
  configSource: string;
  pageSource: string;
  configPath: string;
  pagePath: string;
  sourceSha: string;
}): ParsedDeploymentRecipe | null {
  const config = configObject(args.configSource);
  if (!config) return null;
  const meta = frontmatter(args.pageSource);
  const modelName = stringValue(property(config, "modelName")) ?? meta.title;
  if (!modelName) return null;

  const modelNames = stringObject(property(config, "modelNames"));
  const cookbookModel = stringValue(property(property(config, "github"), "cookbookModel"));
  const artifactRepos = [...new Set([
    ...modelNames.map((entry) => entry.value),
    ...(cookbookModel ? [cookbookModel] : []),
  ].filter((value) => value.includes("/")))];
  if (artifactRepos.length === 0) return null;

  const quantizations = quantizationOptions(config);
  const quantizationLabels = new Map(quantizations.map((item) => [item.id, item.label]));
  const variantLabels = new Map(options(property(config, "variants")).map((item) => [item.id, item.label]));
  const variants = modelNames.length > 0
    ? modelNames.map(({ key, value }) => {
        const parts = key.split("|");
        const variant = parts.find((part) => variantLabels.has(part));
        const quantization = [...parts].reverse().find((part) => quantizationLabels.has(part));
        return {
          key,
          modelId: value,
          precision: quantization ? quantizationLabels.get(quantization)! : "See cookbook",
          description: variant ? variantLabels.get(variant) : undefined,
        };
      })
    : [{ key: "default", modelId: cookbookModel!, precision: quantizations.map((item) => item.label).join(" / ") || "See cookbook" }];
  const verified = collectVerifiedHardware(config);
  const supportedHardware = stringArray(property(config, "supportedHardware"));
  const strategies = options(property(config, "strategies")).map((item) => item.label);
  const pageUrl = `https://docs.sglang.ai/${args.pagePath.replace(/^docs\//, "").replace(/\.mdx$/, "")}`;
  const sourceUrl = `https://github.com/sgl-project/sglang/blob/${args.sourceSha}/${args.configPath}`;
  const publisher = artifactRepos[0].split("/")[0];
  const recipe: ParsedDeploymentRecipe = {
    provider: "sglang",
    runtime: "SGLang",
    upstreamId: args.configPath,
    title: meta.title ?? modelName,
    publisher,
    description: meta.description ?? `Official SGLang deployment cookbook for ${modelName}.`,
    recipeUrl: pageUrl,
    sourceUrl,
    sourceSha: args.sourceSha,
    tasks: [args.pagePath.includes("/diffusion/") ? "diffusion" : "autoregressive"],
    features: strategies,
    hardware: supportedHardware.map((id) => ({
      id,
      label: hardwareLabel(id),
      status: verified.has(id) ? "verified" : "documented",
    })),
    variants,
    artifactRepos,
    contentHash: "",
  };
  return {
    ...recipe,
    contentHash: stableHash({
      provider: recipe.provider,
      runtime: recipe.runtime,
      upstreamId: recipe.upstreamId,
      title: recipe.title,
      publisher: recipe.publisher,
      description: recipe.description,
      recipeUrl: recipe.recipeUrl,
      tasks: recipe.tasks,
      features: recipe.features,
      hardware: recipe.hardware,
      variants: recipe.variants,
      artifactRepos: recipe.artifactRepos,
    }),
  };
}
