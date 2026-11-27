declare module 'mammoth/mammoth.browser.js' {
  export interface MammothHtmlResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer } | { path: string },
    options?: Record<string, unknown>
  ): Promise<MammothHtmlResult>;

  const mammoth: { convertToHtml: typeof convertToHtml };
  export default mammoth;
}
