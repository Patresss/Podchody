import saveAs from "file-saver";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import type { Point, Project, PuzzleType, RoutePlan } from "../types";
import { distanceMeters, formatDistance } from "./geo";
import { versionedPhotoUrl } from "./photo-url";

const PAGE_W = 1240;
const PAGE_H = 1754;
const COLORS = {
  ink: "#16352f",
  muted: "#66756f",
  paper: "#ffffff",
  surface: "#ffffff",
  blue: "#3769d4",
  blueSoft: "#e8eefc",
  green: "#118465",
  greenSoft: "#e2f4ed",
  orange: "#ed7a3d",
  orangeSoft: "#fcece3",
  border: "#d9dfd8",
};

type PdfInput = {
  project: Project;
  route: RoutePlan;
  orderedPoints: Point[];
  hidingPointIds: string[];
  routeMap: string;
};

export type PrintDocumentKind = "organizer" | "cards";

function organizerPointName(point: Point, index: number) {
  return point.displayName?.trim() || `Punkt ${index + 1}`;
}

function newPage() {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Przeglądarka nie udostępnia Canvas 2D.");
  context.fillStyle = COLORS.paper;
  context.fillRect(0, 0, PAGE_W, PAGE_H);
  context.textBaseline = "alphabetic";
  return { canvas, context };
}

async function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nie udało się wczytać obrazu do PDF-u."));
    image.src = source;
  });
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.stroke();
  }
}

function text(context: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = COLORS.ink, weight = 600, align: CanvasTextAlign = "left") {
  context.font = `${weight} ${size}px Manrope, Arial, sans-serif`;
  context.fillStyle = color;
  context.textAlign = align;
  context.fillText(value, x, y);
}

function clippedText(context: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, size: number, color = COLORS.muted, weight = 600) {
  context.font = `${weight} ${size}px Manrope, Arial, sans-serif`;
  let output = value;
  while (output.length > 1 && context.measureText(`${output}…`).width > maxWidth) output = output.slice(0, -1).trimEnd();
  if (output !== value) output = `${output}…`;
  context.fillStyle = color;
  context.textAlign = "left";
  context.fillText(output, x, y);
}

function wrapText(context: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3) {
  const words = value.split(/\s+/);
  let line = "";
  let lineIndex = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y + lineIndex * lineHeight);
      lineIndex += 1;
      line = word;
      if (lineIndex >= maxLines - 1) break;
    } else {
      line = candidate;
    }
  }
  if (lineIndex < maxLines) context.fillText(line, x, y + lineIndex * lineHeight);
}

function drawCoverImage(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, radius = 20) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.save();
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.clip();
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  context.restore();
  return { scale, sourceX, sourceY, sourceWidth, sourceHeight };
}

function drawHideTarget(context: CanvasRenderingContext2D, point: Point, image: HTMLImageElement, box: { x: number; y: number; width: number; height: number }, crop: ReturnType<typeof drawCoverImage>) {
  if (point.markerX == null || point.markerY == null) return;
  const naturalX = point.markerX * image.naturalWidth;
  const naturalY = point.markerY * image.naturalHeight;
  const relativeX = (naturalX - crop.sourceX) / crop.sourceWidth;
  const relativeY = (naturalY - crop.sourceY) / crop.sourceHeight;
  if (relativeX < 0 || relativeX > 1 || relativeY < 0 || relativeY > 1) return;
  const x = box.x + relativeX * box.width;
  const y = box.y + relativeY * box.height;
  context.save();
  context.strokeStyle = COLORS.orange;
  context.lineWidth = 8;
  context.fillStyle = "rgba(255,255,255,.78)";
  context.beginPath();
  context.arc(x, y, 28, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(x - 40, y);
  context.lineTo(x + 40, y);
  context.moveTo(x, y - 40);
  context.lineTo(x, y + 40);
  context.stroke();
  context.restore();
}

function drawPlaceIcon(context: CanvasRenderingContext2D, x: number, y: number, scale = 1) {
  context.save();
  context.strokeStyle = COLORS.blue;
  context.lineWidth = 5 * scale;
  context.lineCap = "round";
  context.strokeRect(x - 18 * scale, y - 24 * scale, 36 * scale, 27 * scale);
  context.beginPath();
  context.moveTo(x, y - 48 * scale);
  context.lineTo(x, y - 10 * scale);
  context.moveTo(x - 12 * scale, y - 22 * scale);
  context.lineTo(x, y - 10 * scale);
  context.lineTo(x + 12 * scale, y - 22 * scale);
  context.moveTo(x - 27 * scale, y + 12 * scale);
  context.lineTo(x + 27 * scale, y + 12 * scale);
  context.stroke();
  context.restore();
}

function drawFootprints(context: CanvasRenderingContext2D, x: number, y: number, scale = 1) {
  context.save();
  context.fillStyle = COLORS.green;
  context.translate(x, y);
  context.rotate(-0.28);
  context.beginPath();
  context.ellipse(-12 * scale, 10 * scale, 9 * scale, 17 * scale, 0, 0, Math.PI * 2);
  context.ellipse(13 * scale, -12 * scale, 9 * scale, 17 * scale, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawMeta(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  roundedRect(context, x, y, width, height, 20, COLORS.greenSoft);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  context.strokeStyle = COLORS.green;
  context.lineWidth = 10;
  context.beginPath();
  context.moveTo(centerX - 55, centerY + 62);
  context.lineTo(centerX - 55, centerY - 65);
  context.stroke();
  context.fillStyle = COLORS.orange;
  context.beginPath();
  context.moveTo(centerX - 50, centerY - 60);
  context.lineTo(centerX + 70, centerY - 30);
  context.lineTo(centerX - 50, centerY + 2);
  context.closePath();
  context.fill();
  text(context, "META", centerX, centerY + 105, 34, COLORS.ink, 800, "center");
}

function drawStart(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  roundedRect(context, x, y, width, height, 20, COLORS.greenSoft);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  drawFootprints(context, centerX - 34, centerY - 18, 1.5);
  drawFootprints(context, centerX + 20, centerY + 17, 1.5);
  text(context, "START", centerX, centerY + 105, 34, COLORS.ink, 800, "center");
}

function addCanvasPage(document: jsPDF, canvas: HTMLCanvasElement, first: boolean) {
  if (!first) document.addPage("a4", "portrait");
  document.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 210, 297, undefined, "FAST");
}

function pdfDocument() {
  return new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
}

function safeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "trasa";
}

function pathDistance(points: Point[]) {
  return points.slice(1).reduce((sum, point, index) => sum + distanceMeters(points[index]!, point), 0);
}

function drawOrganizerPointCard(context: CanvasRenderingContext2D, point: Point, nextPoint: Point | null, index: number, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  roundedRect(context, x, y, width, height, 20, COLORS.surface, COLORS.border);
  const padding = 12;
  const imageWidth = Math.min(width * 0.48, Math.max(230, height * 1.12));
  const imageFrame = { x: x + padding, y: y + padding, width: imageWidth, height: height - padding * 2 };
  roundedRect(context, imageFrame.x, imageFrame.y, imageFrame.width, imageFrame.height, 14, "#eef1eb");
  const scale = Math.min(imageFrame.width / image.naturalWidth, imageFrame.height / image.naturalHeight);
  const actualBox = {
    x: imageFrame.x + (imageFrame.width - image.naturalWidth * scale) / 2,
    y: imageFrame.y + (imageFrame.height - image.naturalHeight * scale) / 2,
    width: image.naturalWidth * scale,
    height: image.naturalHeight * scale,
  };
  context.save();
  context.beginPath();
  context.roundRect(imageFrame.x, imageFrame.y, imageFrame.width, imageFrame.height, 14);
  context.clip();
  context.drawImage(image, actualBox.x, actualBox.y, actualBox.width, actualBox.height);
  context.restore();
  drawHideTarget(context, point, image, actualBox, { scale, sourceX: 0, sourceY: 0, sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight });

  const copyX = imageFrame.x + imageFrame.width + 18;
  roundedRect(context, copyX, y + 18, 40, 40, 20, COLORS.ink);
  text(context, String(index + 1), copyX + 20, y + 46, 18, COLORS.surface, 800, "center");
  text(context, `PUNKT ${index + 1}`, copyX + 52, y + 44, 16, COLORS.green, 800);
  const label = point.displayName?.trim() || "Miejsce schowania karty";
  context.font = `750 22px Manrope, Arial, sans-serif`;
  context.fillStyle = COLORS.ink;
  context.textAlign = "left";
  wrapText(context, label, copyX, y + 91, width - (copyX - x) - 18, 28, 2);
  const footer = nextPoint
    ? `DO NASTĘPNEGO PUNKTU: ${formatDistance(distanceMeters(point, nextPoint))}`
    : "OSTATNI PUNKT - META";
  text(context, footer, copyX, y + height - 24, 14, nextPoint ? COLORS.blue : COLORS.green, 800);
}

async function createOrganizerPdf(input: PdfInput, images: Map<string, HTMLImageElement>) {
  const document = pdfDocument();
  let first = true;
  const pointMap = new Map(input.orderedPoints.map((point) => [point.id, point]));
  const hidingPoints = input.hidingPointIds.map((id) => pointMap.get(id)).filter((point): point is Point => Boolean(point));
  const hidingDistance = pathDistance(hidingPoints);
  const routeSummary = `${input.orderedPoints.length} punktów  |  Szukający: ${formatDistance(input.route.totalDistanceMeters)}  |  Chowający: ${formatDistance(hidingDistance)}`;
  {
    const { canvas, context } = newPage();
    text(context, input.project.name.toUpperCase(), 48, 52, 16, COLORS.green, 800);
    text(context, input.route.name, 48, 96, 34, COLORS.ink, 800);
    text(context, routeSummary, 1192, 92, 17, COLORS.muted, 650, "right");
    text(context, "MAPA GRY DZIECI - KOLEJNOŚĆ SZUKANIA", 48, 119, 12, COLORS.green, 800);
    const map = await loadImage(input.routeMap);
    roundedRect(context, 48, 128, 1144, 632, 24, COLORS.surface, COLORS.border);
    drawCoverImage(context, map, 60, 140, 1120, 608, 16);
    text(context, "PLAN ORGANIZATORA", 48, 810, 18, COLORS.green, 800);
    text(context, "Miejsca schowania kart", 48, 848, 28, COLORS.ink, 800);

    const startY = 878;
    const gap = 14;
    const columnGap = 16;
    const cardWidth = (PAGE_W - 96 - columnGap) / 2;
    const cardHeight = (PAGE_H - startY - 44 - gap * 3) / 4;
    input.orderedPoints.slice(0, 8).forEach((point, localIndex) => {
      const column = localIndex % 2;
      const row = Math.floor(localIndex / 2);
      drawOrganizerPointCard(context, point, input.orderedPoints[localIndex + 1] ?? null, localIndex, images.get(point.id)!, 48 + column * (cardWidth + columnGap), startY + row * (cardHeight + gap), cardWidth, cardHeight);
    });
    addCanvasPage(document, canvas, first); first = false;
  }

  for (let offset = 8; offset < input.orderedPoints.length; offset += 10) {
    const { canvas, context } = newPage();
    text(context, "PLAN ORGANIZATORA", 48, 54, 16, COLORS.green, 800);
    text(context, input.route.name, 48, 98, 30, COLORS.ink, 800);
    text(context, `${routeSummary}  |  Karty ${offset + 1}-${Math.min(offset + 10, input.orderedPoints.length)}`, 1192, 94, 15, COLORS.muted, 600, "right");
    const startY = 130;
    const gap = 14;
    const columnGap = 16;
    const cardWidth = (PAGE_W - 96 - columnGap) / 2;
    const cardHeight = (PAGE_H - startY - 44 - gap * 4) / 5;
    input.orderedPoints.slice(offset, offset + 10).forEach((point, localIndex) => {
      const index = offset + localIndex;
      const column = localIndex % 2;
      const row = Math.floor(localIndex / 2);
      drawOrganizerPointCard(context, point, input.orderedPoints[index + 1] ?? null, index, images.get(point.id)!, 48 + column * (cardWidth + columnGap), startY + row * (cardHeight + gap), cardWidth, cardHeight);
    });
    addCanvasPage(document, canvas, first); first = false;
  }
  return document.output("blob");
}

async function createCardsPdf(input: PdfInput, images: Map<string, HTMLImageElement>) {
  const document = pdfDocument();
  let first = true;
  const hidingOrder = new Map(input.hidingPointIds.map((pointId, index) => [pointId, index + 1]));
  const cards: PrintCard[] = [
    { current: null, next: input.orderedPoints[0]!, type: "start", gameTargetNumber: 1, hidingOrderNumber: null, puzzle: createCardPuzzle(input.route.puzzleType) },
    ...input.orderedPoints.map((current, index) => ({
      current,
      next: input.orderedPoints[index + 1] ?? null,
      type: index === input.orderedPoints.length - 1 ? "meta" as const : "step" as const,
      gameTargetNumber: index < input.orderedPoints.length - 1 ? index + 2 : null,
      hidingOrderNumber: hidingOrder.get(current.id) ?? null,
      puzzle: createCardPuzzle(input.route.puzzleType),
    })),
  ];

  for (let offset = 0; offset < cards.length; offset += 4) {
    const { canvas, context } = newPage();
    const cardWidth = PAGE_W / 2;
    const cardHeight = PAGE_H / 2;
    cards.slice(offset, offset + 4).forEach((card, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      drawCard(context, card, images, input.route.name, column * cardWidth, row * cardHeight, cardWidth, cardHeight);
    });
    context.save();
    context.strokeStyle = "#6f7c76";
    context.lineWidth = 1.5;
    context.setLineDash([7, 7]);
    context.beginPath();
    context.moveTo(PAGE_W / 2, 12); context.lineTo(PAGE_W / 2, PAGE_H - 12);
    context.moveTo(12, PAGE_H / 2); context.lineTo(PAGE_W - 12, PAGE_H / 2);
    context.stroke();
    context.restore();
    addCanvasPage(document, canvas, first); first = false;
  }
  return document.output("blob");
}

type PrintCard = {
  current: Point | null;
  next: Point | null;
  type: "start" | "step" | "meta";
  gameTargetNumber: number | null;
  hidingOrderNumber: number | null;
  puzzle: CardPuzzle | null;
};

type PuzzleShape = "circle" | "square" | "triangle";
type CardPuzzle =
  | { type: "equation"; expression: string }
  | { type: "counting"; count: number }
  | { type: "pattern"; shapes: PuzzleShape[] };

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createCardPuzzle(type: PuzzleType | null): CardPuzzle | null {
  if (!type) return null;
  if (type === "counting") return { type: "counting", count: randomInt(3, 10) };
  if (type === "patterns") {
    const shapes: PuzzleShape[] = ["circle", "square", "triangle"];
    const first = shapes[randomInt(0, shapes.length - 1)]!;
    let second = first;
    while (second === first) second = shapes[randomInt(0, shapes.length - 1)]!;
    return { type: "pattern", shapes: Math.random() < 0.5 ? [first, second, first, second, first] : [first, first, second, first, first] };
  }
  const limit = type === "math-10" ? 10 : 20;
  if (Math.random() < 0.5) {
    const left = randomInt(1, limit - 1);
    const right = randomInt(1, limit - left);
    return { type: "equation", expression: `${left} + ${right} = ____` };
  }
  const left = randomInt(2, limit);
  const right = randomInt(1, left);
  return { type: "equation", expression: `${left} - ${right} = ____` };
}

function drawPuzzleShape(context: CanvasRenderingContext2D, shape: PuzzleShape, centerX: number, centerY: number, size: number, color: string) {
  context.save();
  context.fillStyle = color;
  context.beginPath();
  if (shape === "circle") context.arc(centerX, centerY, size, 0, Math.PI * 2);
  else if (shape === "square") context.roundRect(centerX - size, centerY - size, size * 2, size * 2, 4);
  else {
    context.moveTo(centerX, centerY - size - 2);
    context.lineTo(centerX + size + 2, centerY + size);
    context.lineTo(centerX - size - 2, centerY + size);
    context.closePath();
  }
  context.fill();
  context.restore();
}

function drawPuzzle(context: CanvasRenderingContext2D, puzzle: CardPuzzle, x: number, y: number, width: number, height: number) {
  roundedRect(context, x, y, width, height, 14, COLORS.orangeSoft);
  roundedRect(context, x + 13, y + height / 2 - 19, 38, 38, 19, COLORS.orange);
  text(context, "?", x + 32, y + height / 2 + 9, 24, COLORS.surface, 800, "center");
  const contentX = x + 70;
  const centerY = y + height / 2;
  if (puzzle.type === "equation") {
    text(context, puzzle.expression, contentX + (width - 84) / 2, centerY + 11, 30, COLORS.ink, 800, "center");
    return;
  }
  if (puzzle.type === "counting") {
    const step = 23;
    const dotsWidth = (puzzle.count - 1) * step + 16;
    const answerWidth = 92;
    const startX = contentX + Math.max(0, (width - 84 - dotsWidth - answerWidth) / 2);
    for (let index = 0; index < puzzle.count; index += 1) {
      context.fillStyle = index % 2 === 0 ? COLORS.green : COLORS.blue;
      context.beginPath();
      context.arc(startX + index * step + 8, centerY, 8, 0, Math.PI * 2);
      context.fill();
    }
    text(context, "= ____", startX + dotsWidth + 17, centerY + 10, 27, COLORS.ink, 800);
    return;
  }
  const step = 48;
  const startX = contentX + Math.max(0, (width - 84 - step * 6) / 2) + 20;
  puzzle.shapes.forEach((shape, index) => drawPuzzleShape(context, shape, startX + index * step, centerY, 12, index % 2 === 0 ? COLORS.green : COLORS.blue));
  context.save();
  context.strokeStyle = COLORS.orange;
  context.lineWidth = 3;
  context.setLineDash([5, 4]);
  context.strokeRect(startX + puzzle.shapes.length * step - 15, centerY - 17, 34, 34);
  context.restore();
}

function drawNumberBadge(context: CanvasRenderingContext2D, number: number, centerX: number, centerY: number, color: string) {
  roundedRect(context, centerX - 20, centerY - 20, 40, 40, 20, color);
  text(context, String(number), centerX, centerY + 7, 18, COLORS.surface, 800, "center");
}

function drawCard(context: CanvasRenderingContext2D, card: PrintCard, images: Map<string, HTMLImageElement>, routeName: string, x: number, y: number, width: number, height: number) {
  const safe = 28;
  const gap = 14;
  const headerHeight = 62;
  const middleHeight = 56;
  const puzzleHeight = card.puzzle ? 72 : 0;
  const contentX = x + safe;
  const contentWidth = width - safe * 2;
  const headerY = y + safe;
  const imageHeight = (height - safe * 2 - headerHeight - middleHeight - puzzleHeight - gap * (card.puzzle ? 4 : 3)) / 2;
  const firstImageY = headerY + headerHeight + gap;
  const middleY = firstImageY + imageHeight + gap;
  const secondImageY = middleY + middleHeight + gap;
  const puzzleY = secondImageY + imageHeight + gap;
  if (card.type === "start") {
    roundedRect(context, contentX, headerY, contentWidth, headerHeight, 14, COLORS.greenSoft);
    drawFootprints(context, contentX + 42, headerY + 31, 0.58);
    text(context, "START", contentX + 77, headerY + 29, 18, COLORS.green, 800);
    clippedText(context, routeName, contentX + 77, headerY + 49, contentWidth - 96, 10, COLORS.muted, 600);
    drawStart(context, contentX, firstImageY, contentWidth, imageHeight);
    roundedRect(context, contentX, middleY, contentWidth, middleHeight, 14, COLORS.greenSoft);
    drawFootprints(context, contentX + 42, middleY + 29, 0.58);
    text(context, "BIEGNIJ TAM", contentX + 77, middleY + 36, 17, COLORS.green, 800);
    drawNumberBadge(context, card.gameTargetNumber!, contentX + contentWidth - 24, middleY + 28, COLORS.green);
    drawCoverImage(context, images.get(card.next!.id)!, contentX, secondImageY, contentWidth, imageHeight, 16);
    if (card.puzzle) drawPuzzle(context, card.puzzle, contentX, puzzleY, contentWidth, puzzleHeight);
    return;
  }
  roundedRect(context, contentX, headerY, contentWidth, headerHeight, 14, COLORS.blueSoft);
  drawPlaceIcon(context, contentX + 42, headerY + 38, 0.64);
  text(context, "TU ZOSTAW KARTĘ", contentX + 77, headerY + 29, 18, COLORS.blue, 800);
  clippedText(context, routeName, contentX + 77, headerY + 49, contentWidth - 150, 10, COLORS.muted, 600);
  drawNumberBadge(context, card.hidingOrderNumber!, contentX + contentWidth - 24, headerY + 31, COLORS.blue);
  const currentImage = images.get(card.current!.id)!;
  const currentBox = { x: contentX, y: firstImageY, width: contentWidth, height: imageHeight };
  const crop = drawCoverImage(context, currentImage, currentBox.x, currentBox.y, currentBox.width, currentBox.height, 16);
  drawHideTarget(context, card.current!, currentImage, currentBox, crop);
  roundedRect(context, contentX, middleY, contentWidth, middleHeight, 14, COLORS.greenSoft);
  drawFootprints(context, contentX + 42, middleY + 29, 0.58);
  text(context, card.type === "meta" ? "TU JEST META" : "POTEM BIEGNIJ TAM", contentX + 77, middleY + 36, 17, COLORS.green, 800);
  if (card.gameTargetNumber != null) drawNumberBadge(context, card.gameTargetNumber, contentX + contentWidth - 24, middleY + 28, COLORS.green);
  if (card.type === "meta") {
    drawMeta(context, contentX, secondImageY, contentWidth, imageHeight);
  } else {
    drawCoverImage(context, images.get(card.next!.id)!, contentX, secondImageY, contentWidth, imageHeight, 16);
  }
  if (card.puzzle) drawPuzzle(context, card.puzzle, contentX, puzzleY, contentWidth, puzzleHeight);
}

async function loadPointImages(input: PdfInput, onProgress?: (label: string) => void) {
  await document.fonts.ready;
  onProgress?.("Przygotowuję zdjęcia…");
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(input.orderedPoints.map(async (point) => images.set(point.id, await loadImage(versionedPhotoUrl(point.previewUrl, point.createdAt)))));
  return images;
}

export async function buildPrintPackage(input: PdfInput, onProgress?: (label: string) => void) {
  const images = await loadPointImages(input, onProgress);
  onProgress?.("Składam plan organizatora…");
  const organizer = await createOrganizerPdf(input, images);
  onProgress?.("Składam karty do wycięcia…");
  const cards = await createCardsPdf(input, images);
  const zip = new JSZip();
  const base = safeName(input.route.name);
  zip.file(`01-${base}-plan-organizatora.pdf`, new Uint8Array(await organizer.arrayBuffer()));
  zip.file(`02-${base}-karty-a4.pdf`, new Uint8Array(await cards.arrayBuffer()));
  zip.file("README.txt", [
    `${input.project.name} - ${input.route.name}`,
    "",
    "01: mapa i kolejność gry dla organizatora",
    "02: karty, cztery sztuki na stronie A4; zielone numery to kolejność gry, niebieskie to kolejność chowania",
    input.route.puzzleType ? "Zagadki są losowane osobno dla każdej karty podczas tworzenia PDF-u." : "",
    "",
    "Mapy: © OpenStreetMap contributors",
  ].join("\n"));
  onProgress?.("Pakuję pliki…");
  return {
    blob: await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }),
    filename: `${base}-wydruki.zip`,
  };
}

export async function buildSinglePdf(input: PdfInput, kind: PrintDocumentKind, onProgress?: (label: string) => void) {
  const images = await loadPointImages(input, onProgress);
  const base = safeName(input.route.name);
  if (kind === "organizer") {
    onProgress?.("Składam plan organizatora…");
    return { blob: await createOrganizerPdf(input, images), filename: `01-${base}-plan-organizatora.pdf` };
  }
  onProgress?.("Składam karty do wycięcia…");
  return { blob: await createCardsPdf(input, images), filename: `02-${base}-karty-a4.pdf` };
}

export async function generatePrintPackage(input: PdfInput, onProgress?: (label: string) => void) {
  const result = await buildPrintPackage(input, onProgress);
  saveAs(result.blob, result.filename);
}

export async function generateSinglePdf(input: PdfInput, kind: PrintDocumentKind, onProgress?: (label: string) => void) {
  const result = await buildSinglePdf(input, kind, onProgress);
  saveAs(result.blob, result.filename);
}
