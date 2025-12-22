// NOTE:
// This file exists to share the "Create wizard" data contract across the legacy
// step components in `src/components/create/*`.
// The current app route `/create` uses `CreateNew.tsx`, but these step components
// still compile as part of the TS project, so we keep the type here.

export interface CreateCustomElement {
  id: string;
  url: string;
  name?: string;
  brand?: string;
}

export interface CreateData {
  // Avatar
  avatarId?: string;
  avatarPositions?: string[];
  avatarPosition?: string;
  avatarImportance?: number;

  // Expressions
  expressions?: string[];

  // Elements / Products
  productIds?: string[];
  productPositions?: string[];
  productPosition?: string;
  productImportance?: number;
  customProductElements?: CreateCustomElement[];

  // Text
  title?: string;
  subtitle?: string;
  titleMode?: "custom" | "ai";
  subtitleMode?: "custom" | "ai";
  textPositions?: string[];
  textPosition?: string;
  textImportance?: number;
  textStyle?: string;

  // Visual style
  visualStyles?: string[];

  // Background
  backgroundType?: string;
  backgroundValue?: string;

  // Misc
  aspectRatio?: string;
}


