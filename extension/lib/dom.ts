type ElementConstructor<T extends Element> = {
  new (): T;
  readonly name: string;
};

/** A missing or wrong-typed node is a markup bug, so fail at the boundary. */
export function query<T extends Element>(
  root: ParentNode,
  selector: string,
  Type: ElementConstructor<T>,
): T {
  const found = root.querySelector(selector);
  if (!(found instanceof Type)) {
    throw new Error(`expected ${Type.name} matching "${selector}"`);
  }
  return found;
}
