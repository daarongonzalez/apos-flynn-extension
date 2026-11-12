import type { Description } from './describe.ts';

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
  /** How many elements on the page share the same original text. */
  total?: number;
  /** Where the element sits on the page. Missing on drafts saved by earlier versions. */
  where?: Description;
}

export interface ChangeView {
  id: string;
  label: string;
  before: string;
  after: string;
  /** The saved edit could not be found on the page as it is now. */
  missing: boolean;
  occurrence: number;
  total?: number;
  where?: Description;
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
