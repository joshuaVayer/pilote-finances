// Pilote Finances — widget iPhone (Scriptable)
// -------------------------------------------------
// 1. Installez l'app « Scriptable » (App Store, gratuite).
// 2. Créez un nouveau script, collez ce fichier.
// 3. Remplacez SNAPSHOT_URL par l'URL affichée dans
//    Pilote Finances → Plus → Réglages → « URL à coller ».
// 4. Écran d'accueil → appui long → + → Scriptable → petit ou moyen →
//    choisissez ce script.
// Guide complet : docs/WIDGET_IPHONE.md du dépôt.

const SNAPSHOT_URL = "COLLEZ_ICI_L_URL_DU_SNAPSHOT";

// --- Couleurs (clair/sombre automatique) ---
const COLORS = {
  bg: Color.dynamic(new Color("#ffffff"), new Color("#191c23")),
  ink: Color.dynamic(new Color("#1a1d23"), new Color("#eceef2")),
  ink2: Color.dynamic(new Color("#5a6272"), new Color("#a6adbd")),
  good: Color.dynamic(new Color("#157f3d"), new Color("#4ade80")),
  warn: Color.dynamic(new Color("#b45309"), new Color("#fbbf24")),
  bad: Color.dynamic(new Color("#b91c1c"), new Color("#f87171")),
};

function statusColor(executionStatus) {
  if (executionStatus === "CRITICAL") return COLORS.bad;
  if (executionStatus === "SLIGHTLY_BEHIND" || executionStatus === "OFF_TRACK") return COLORS.warn;
  return COLORS.good;
}

function euros(cents, hide) {
  if (hide) return "•••";
  const value = Math.round(cents / 100);
  return value.toLocaleString("fr-FR") + " €";
}

function frenchDay(isoDate) {
  const [, month, day] = isoDate.split("-");
  return `${Number(day)}/${Number(month)}`;
}

async function loadSnapshot() {
  try {
    const request = new Request(SNAPSHOT_URL);
    request.timeoutInterval = 15;
    // Anti-cache : le gist raw peut être servi avec un léger délai.
    request.headers = { "Cache-Control": "no-cache" };
    return await request.loadJSON();
  } catch (error) {
    return null;
  }
}

function isStale(snapshot) {
  if (!snapshot || !snapshot.generatedOn) return true;
  const [y, m, d] = snapshot.generatedOn.split("-").map(Number);
  const generated = new Date(y, m - 1, d);
  const ageDays = (Date.now() - generated.getTime()) / 86400000;
  return ageDays > 3;
}

function buildErrorWidget(message) {
  const widget = new ListWidget();
  widget.backgroundColor = COLORS.bg;
  const text = widget.addText("Pilote Finances");
  text.font = Font.boldSystemFont(12);
  text.textColor = COLORS.ink2;
  widget.addSpacer(6);
  const info = widget.addText(message);
  info.font = Font.systemFont(11);
  info.textColor = COLORS.ink2;
  return widget;
}

function buildWidget(snapshot, family) {
  const hide = snapshot.hideAmounts === true;
  const widget = new ListWidget();
  widget.backgroundColor = COLORS.bg;
  widget.setPadding(14, 14, 14, 14);

  // En-tête : pastille de statut + titre.
  const header = widget.addStack();
  header.centerAlignContent();
  const dot = header.addText("●");
  dot.font = Font.systemFont(9);
  dot.textColor = statusColor(snapshot.executionStatus);
  header.addSpacer(5);
  const title = header.addText("SAFE TO SPEND");
  title.font = Font.boldSystemFont(10);
  title.textColor = COLORS.ink2;

  widget.addSpacer();

  if (family === "medium") {
    const body = widget.addStack();
    body.centerAlignContent();

    const left = body.addStack();
    left.layoutVertically();
    const amount = left.addText(euros(snapshot.safeToSpendToday, hide));
    amount.font = Font.boldRoundedSystemFont(32);
    amount.textColor = COLORS.ink;
    amount.minimumScaleFactor = 0.6;
    amount.lineLimit = 1;
    const sub = left.addText("aujourd'hui");
    sub.font = Font.systemFont(10);
    sub.textColor = COLORS.ink2;

    body.addSpacer();

    const right = body.addStack();
    right.layoutVertically();
    const untilLabel = right.addText("Jusqu'à la paie");
    untilLabel.font = Font.systemFont(10);
    untilLabel.textColor = COLORS.ink2;
    const until = right.addText(euros(snapshot.safeToSpendUntilIncome, hide));
    until.font = Font.boldSystemFont(15);
    until.textColor = COLORS.ink;
    if (snapshot.nextObligation) {
      right.addSpacer(5);
      const obligationLabel = right.addText("Prochaine échéance");
      obligationLabel.font = Font.systemFont(10);
      obligationLabel.textColor = COLORS.ink2;
      const obligation = right.addText(
        `${euros(snapshot.nextObligation.amount, hide)} · ${frenchDay(snapshot.nextObligation.date)}`
      );
      obligation.font = Font.mediumSystemFont(12);
      obligation.textColor = COLORS.ink;
      obligation.lineLimit = 1;
    }
  } else {
    const amount = widget.addText(euros(snapshot.safeToSpendToday, hide));
    amount.font = Font.boldRoundedSystemFont(30);
    amount.textColor = COLORS.ink;
    amount.minimumScaleFactor = 0.6;
    amount.lineLimit = 1;
    const sub = widget.addText("aujourd'hui");
    sub.font = Font.systemFont(10);
    sub.textColor = COLORS.ink2;
  }

  if (snapshot.projectedDeficit !== null && snapshot.projectedDeficit > 0) {
    widget.addSpacer(4);
    const deficit = widget.addText(`Déficit : ${euros(snapshot.projectedDeficit, hide)}`);
    deficit.font = Font.boldSystemFont(10);
    deficit.textColor = COLORS.bad;
    deficit.lineLimit = 1;
  }

  widget.addSpacer();

  // Rafraîchissement dans ~15 minutes.
  widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  return widget;
}

// --- Point d'entrée ---
const snapshot = await loadSnapshot();
let widget;
if (SNAPSHOT_URL.startsWith("COLLEZ")) {
  widget = buildErrorWidget("Collez l'URL du snapshot\n(Réglages de l'app web).");
} else if (!snapshot) {
  widget = buildErrorWidget("Snapshot inaccessible.\nVérifiez l'URL et le réseau.");
} else if (isStale(snapshot)) {
  widget = buildErrorWidget("Données anciennes —\nouvrez l'app pour actualiser.");
} else {
  const family = config.widgetFamily === "medium" ? "medium" : "small";
  widget = buildWidget(snapshot, family);
}

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
