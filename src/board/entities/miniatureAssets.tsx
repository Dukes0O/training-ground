import playerAtlas from "../../assets/miniature-players.webp?inline";

// Embed once per board. A data URI keeps exported SVG frames self-contained;
// symbols crop the six alpha cutouts without another canvas or network request.
const sprites = [
  { id: "home-idle", box: "165 30 283 425" },
  { id: "away-idle", box: "632 37 279 420" },
  { id: "neutral-idle", box: "1095 33 282 424" },
  { id: "home-run", box: "191 527 261 452" },
  { id: "away-run", box: "648 518 256 457" },
  { id: "neutral-run", box: "1117 522 258 451" },
];

export function MiniatureAssetDefs() {
  return (
    <defs>
      <image id="tg-miniature-atlas" href={playerAtlas} width={1536} height={1024} />
      {sprites.map(sprite => (
        <symbol key={sprite.id} id={`tg-miniature-${sprite.id}`} viewBox={sprite.box} preserveAspectRatio="xMidYMax meet">
          <use href="#tg-miniature-atlas" />
        </symbol>
      ))}
      <radialGradient id="tg-ball-leather" cx="30%" cy="23%" r="78%">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.55" stopColor="#e7ece7" />
        <stop offset="1" stopColor="#84968d" />
      </radialGradient>
      <radialGradient id="tg-ball-light" cx="32%" cy="24%" r="76%">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.3" />
        <stop offset="0.58" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#14291f" stopOpacity="0.27" />
      </radialGradient>
    </defs>
  );
}
