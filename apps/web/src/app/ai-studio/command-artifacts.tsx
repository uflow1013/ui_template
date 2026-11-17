import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { commandGroups, type ArtifactId } from "./commands";

const artifactGroups = {
  research: () => import("./artifacts/research"),
  agent: () => import("./artifacts/agent"),
  writing: () => import("./artifacts/writing"),
  data: () => import("./artifacts/data"),
  model: () => import("./artifacts/model"),
  media: () => import("./artifacts/media"),
};

type ExportedArtifacts = Awaited<ReturnType<(typeof artifactGroups)[keyof typeof artifactGroups]>>["artifacts"];
type ImplementedId<T> = T extends unknown ? keyof T : never;
type VerifiedArtifactId = Exclude<ArtifactId, ImplementedId<ExportedArtifacts>> extends never ? ArtifactId : never;

export interface ArtifactProps {
  onPrompt: (prompt: string) => void;
}

export const commandArtifacts = Object.fromEntries(
  commandGroups.flatMap((group) => group.tools.map(([id]: readonly [VerifiedArtifactId, string, string]) => [
    id,
    lazy(async () => {
      const { artifacts } = await artifactGroups[group.id]();
      const definition = (artifacts as Partial<Record<ArtifactId, ComponentType<ArtifactProps>>>)[id];
      if (!definition) throw new Error(`Missing studio artifact: ${id}`);
      return { default: definition };
    }),
  ] as const)),
) as Record<ArtifactId, LazyExoticComponent<ComponentType<ArtifactProps>>>;
