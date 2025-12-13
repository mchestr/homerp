/**
 * PDF generation utility for printable labels.
 */

import jsPDF from "jspdf";
import QRCode from "qrcode";

import type { LabelData, LabelPrintOptions, LabelSize } from "./types";

/**
 * Generate a PDF document containing labels.
 */
export async function generateLabelPDF(
  items: LabelData[],
  options: LabelPrintOptions
): Promise<jsPDF> {
  const { labelSize } = options;

  // Create PDF with label dimensions
  const doc = new jsPDF({
    unit: "mm",
    format: [labelSize.width, labelSize.height],
    orientation: labelSize.width > labelSize.height ? "landscape" : "portrait",
  });

  for (let i = 0; i < items.length; i++) {
    if (i > 0) {
      doc.addPage([labelSize.width, labelSize.height]);
    }
    await renderLabel(doc, items[i], labelSize, options);
  }

  return doc;
}

/**
 * Render a single label on the PDF document.
 */
async function renderLabel(
  doc: jsPDF,
  item: LabelData,
  size: LabelSize,
  options: LabelPrintOptions
): Promise<void> {
  const margin = 2;
  const qrSize = Math.min(size.width, size.height) - margin * 2;

  // Calculate text area based on whether QR code is shown
  let textStartX = margin;
  let textWidth = size.width - margin * 2;

  if (options.showQrCode) {
    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(item.qrUrl, {
      width: qrSize * 4, // Higher resolution for print
      margin: 0,
      errorCorrectionLevel: "M",
    });

    // Layout: QR on left for wider labels, or centered for narrow labels
    if (size.width >= size.height * 1.5) {
      // Wide label: QR on left, text on right
      const actualQrSize = Math.min(qrSize, size.height - margin * 2);
      doc.addImage(
        qrDataUrl,
        "PNG",
        margin,
        margin,
        actualQrSize,
        actualQrSize
      );
      textStartX = margin + actualQrSize + 2;
      textWidth = size.width - textStartX - margin;
    } else if (size.width < 30) {
      // Very narrow label (like P-touch tape): stacked layout
      const smallQrSize = Math.min(size.width - margin * 2, 10);
      doc.addImage(
        qrDataUrl,
        "PNG",
        (size.width - smallQrSize) / 2,
        margin,
        smallQrSize,
        smallQrSize
      );
      // Text below QR code
      renderText(
        doc,
        item,
        margin,
        margin + smallQrSize + 1,
        textWidth,
        size,
        options
      );
      return;
    } else {
      // Square or slightly wide label: QR on left
      const actualQrSize = Math.min(size.height - margin * 2, size.width * 0.4);
      doc.addImage(
        qrDataUrl,
        "PNG",
        margin,
        margin,
        actualQrSize,
        actualQrSize
      );
      textStartX = margin + actualQrSize + 2;
      textWidth = size.width - textStartX - margin;
    }
  }

  renderText(doc, item, textStartX, margin, textWidth, size, options);
}

/**
 * Render text content for a label.
 */
function renderText(
  doc: jsPDF,
  item: LabelData,
  startX: number,
  startY: number,
  maxWidth: number,
  size: LabelSize,
  options: LabelPrintOptions
): void {
  let y = startY;

  // Calculate font sizes based on label size
  const baseFontSize = Math.min(size.width, size.height) < 30 ? 6 : 8;
  const titleFontSize = baseFontSize + 2;
  const detailFontSize = baseFontSize - 1;

  // Name (title)
  doc.setFontSize(titleFontSize);
  doc.setFont("helvetica", "bold");
  const nameLines = doc.splitTextToSize(item.name, maxWidth);
  const maxNameLines = size.height < 30 ? 1 : 2;
  const truncatedNameLines = nameLines.slice(0, maxNameLines);
  doc.text(truncatedNameLines, startX, y + titleFontSize * 0.35);
  y += truncatedNameLines.length * (titleFontSize * 0.5) + 1;

  // Secondary info
  doc.setFontSize(detailFontSize);
  doc.setFont("helvetica", "normal");

  // Location
  if (options.showLocation && item.location) {
    const locationText = truncateText(doc, item.location, maxWidth);
    if (y + detailFontSize * 0.35 < size.height - margin) {
      doc.text(locationText, startX, y + detailFontSize * 0.35);
      y += detailFontSize * 0.5 + 0.5;
    }
  }

  // Category
  if (options.showCategory && item.category) {
    const categoryText = truncateText(doc, item.category, maxWidth);
    if (y + detailFontSize * 0.35 < size.height - margin) {
      doc.text(categoryText, startX, y + detailFontSize * 0.35);
      y += detailFontSize * 0.5 + 0.5;
    }
  }

  // Description (if enabled and space allows)
  if (options.showDescription && item.description) {
    const descLines = doc.splitTextToSize(item.description, maxWidth);
    const availableLines = Math.floor(
      (size.height - margin - y) / (detailFontSize * 0.5)
    );
    if (availableLines > 0) {
      const truncatedDescLines = descLines.slice(0, availableLines);
      doc.text(truncatedDescLines, startX, y + detailFontSize * 0.35);
    }
  }
}

const margin = 2;

/**
 * Truncate text to fit within a maximum width.
 */
function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  const textWidth = doc.getTextWidth(text);
  if (textWidth <= maxWidth) {
    return text;
  }

  // Binary search for the right length
  let low = 0;
  let high = text.length;
  const ellipsis = "...";

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const truncated = text.substring(0, mid) + ellipsis;
    if (doc.getTextWidth(truncated) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return text.substring(0, low) + ellipsis;
}

/**
 * Generate label preview as a data URL.
 */
export async function generateLabelPreview(
  items: LabelData[],
  options: LabelPrintOptions
): Promise<string> {
  const pdf = await generateLabelPDF(items, options);
  return pdf.output("datauristring");
}

/**
 * Download labels as PDF.
 */
export async function downloadLabelsPDF(
  items: LabelData[],
  options: LabelPrintOptions,
  filename: string = "labels.pdf"
): Promise<void> {
  const pdf = await generateLabelPDF(items, options);
  pdf.save(filename);
}

/**
 * Open print dialog for labels.
 */
export async function printLabels(
  items: LabelData[],
  options: LabelPrintOptions
): Promise<void> {
  const pdf = await generateLabelPDF(items, options);
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);

  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.addEventListener("load", () => {
      setTimeout(() => {
        printWindow.print();
      }, 100);
    });
  }
}
