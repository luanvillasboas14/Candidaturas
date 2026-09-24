declare module 'html2pdf.js' {
  type Html2Pdf = {
    set: (options: Record<string, unknown>) => Html2Pdf;
    from: (element: HTMLElement) => Html2Pdf;
    save: () => Promise<void>;
    outputPdf: (type: 'datauristring' | 'blob' | 'arraybuffer') => Promise<string | Blob | ArrayBuffer>;
  };
  export default function html2pdf(): Html2Pdf;
}
