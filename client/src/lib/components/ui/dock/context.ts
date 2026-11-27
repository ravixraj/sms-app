export const dockKey = Symbol("dock");

export type DockSettings = {
  readonly mouseX: number;
  readonly iconSize: number;
  readonly iconMagnification: number;
  readonly iconDistance: number;
  readonly disableMagnification: boolean;
};
