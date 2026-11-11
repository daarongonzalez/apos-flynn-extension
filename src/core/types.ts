/** One saved edit. `before` and `after` are the text pieces of the element (see parts.ts). */
export interface Draft {
  id: string;
  label: string;
  before: string[];
  after: string[];
  beforeHTML: string;
  afterHTML: string;
  /** Position among elements on the page that share the same original text. */
  occurrence: number;
}

export interface ChangeView {
  id: string;
  label: string;
  before: string;
  after: string;
  /** The saved edit could not be found on the page as it is now. */
  missing: boolean;
}

export interface PageState {
  url: string;
  title: string;
  editing: boolean;
  unitCount: number;
  changes: ChangeView[];
}

export type PanelMessage =
  | { type: 'flynn:get' }
  | { type: 'flynn:setEditing'; editing: boolean }
  | { type: 'flynn:undo'; id: string }
  | { type: 'flynn:discardAll' }
  | { type: 'flynn:locate'; id: string };

export interface StateMessage {
  type: 'flynn:state';
  state: PageState;
}
