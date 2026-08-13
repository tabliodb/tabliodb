import type { DiagramExportResponseDtoOutput } from '@tabliodb/sdk';

export type DiagramExportWarningInput = {
  code: string;
  message: string;
  statement?: string;
  target?: {
    id: string;
    type: string;
  };
};

type DiagramExportResponseDto = DiagramExportResponseDtoOutput;

export function toDiagramExportWarnings(
  warnings: readonly DiagramExportWarningInput[],
): DiagramExportResponseDto['warnings'] {
  return warnings.map((warning) => ({
    code: warning.code,
    message: warning.message,
    statement: warning.statement,
    target: warning.target
      ? {
          id: warning.target.id,
          type: warning.target.type,
        }
      : undefined,
  }));
}

export async function copyTextToClipboard(value: string): Promise<void> {
  // Clipboard API sengaja dibungkus supaya dialog share dan export bisa memakai perilaku browser yang sama.
  await navigator.clipboard.writeText(value);
}

export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  downloadBlobFile(fileName, new Blob([content], { type: mimeType }));
}

export function downloadBlobFile(fileName: string, blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  // Anchor sementara tetap paling kompatibel untuk download client-side tanpa menambah dependency.
  link.href = objectUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function createPngBlobFromSvg(svg: string): Promise<Blob> {
  const { height, width } = readSvgSize(svg);
  const image = new Image();
  const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('SVG image could not be decoded for PNG export.'));
      image.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(width * pixelRatio);
    canvas.height = Math.ceil(height * pixelRatio);

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas is not available for PNG export.');
    }

    // Scaling the context keeps text and relationship strokes crisp on high-density displays without huge files.
    context.scale(pixelRatio, pixelRatio);
    context.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error('PNG export produced an empty blob.'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function createExportFileStem(projectName?: string, diagramName?: string): string {
  const parts = ['tabliodb', toFileSlug(projectName), toFileSlug(diagramName)].filter(Boolean);

  return parts.join('-') || 'tabliodb-diagram';
}

function readSvgSize(svg: string): { height: number; width: number } {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const svgElement = document.documentElement;
  const width = Number(svgElement.getAttribute('width'));
  const height = Number(svgElement.getAttribute('height'));

  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return { height, width };
  }

  const viewBox = svgElement.getAttribute('viewBox')?.split(/\s+/).map(Number) ?? [];
  const viewBoxWidth = viewBox[2];
  const viewBoxHeight = viewBox[3];

  // Renderer always emits width/height, but viewBox fallback keeps the browser helper resilient to future SVG sources.
  return {
    height: Number.isFinite(viewBoxHeight) && viewBoxHeight > 0 ? viewBoxHeight : 720,
    width: Number.isFinite(viewBoxWidth) && viewBoxWidth > 0 ? viewBoxWidth : 1280,
  };
}

function toFileSlug(value?: string): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
