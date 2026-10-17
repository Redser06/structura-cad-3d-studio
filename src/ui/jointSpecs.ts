/**
 * Static joinery copy and schematics shipped with the app.
 * These strings are not user input.
 */

export const JOINT_SPECS = {
  J1: {
    code: 'J1 · FOUNDATION INTERFACE',
    title: 'Concrete Post Base & Standoff Anchor',
    perJoint: 'Per Post Footing',
    hardware: [
      { name: 'Simpson ABA66Z Standoff Base', spec: '1" Standoff · 14-Ga ZMAX' },
      { name: 'Wedge Expansion Anchor Bolt', spec: '5/8" × 5" Galv (×1)' },
      { name: 'Structural SDS Heavy Screws', spec: '1/4" × 3" Hex (×4)' }
    ],
    steps: [
      'Drill 5/8" hole 4.25" deep into cured concrete pier using a rotary hammer.',
      'Set 1" standoff base plate to prevent end-grain moisture rot; torque nut to 55 ft-lbs.',
      'Plumb post and drive four 1/4"×3" structural screws through the side flanges.'
    ],
    svg: `
      <svg viewBox="0 0 320 150" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="150" fill="#08101f"/>
        <rect x="95" y="102" width="130" height="42" fill="rgba(148,163,184,0.14)" stroke="#64748b" stroke-width="1.2"/>
        <text x="103" y="136" fill="#8a99ad" font-family="IBM Plex Mono" font-size="8.5">CONCRETE PIER (24" MIN)</text>
        <rect x="122" y="12" width="76" height="78" fill="rgba(147,197,253,0.10)" stroke="#93c5fd" stroke-width="1.5"/>
        <text x="135" y="32" fill="#93c5fd" font-family="IBM Plex Mono" font-size="9" font-weight="500">6×6 POST</text>
        <path d="M 118 58 L 118 102 L 202 102 L 202 58" fill="none" stroke="#d4a373" stroke-width="2.5"/>
        <rect x="122" y="90" width="76" height="12" fill="rgba(212,163,115,0.22)" stroke="#d4a373" stroke-width="1.2"/>
        <line x1="160" y1="84" x2="160" y2="132" stroke="#e07a5f" stroke-width="3.5" stroke-dasharray="3,1"/>
        <rect x="153" y="80" width="14" height="4" fill="#e07a5f"/>
        <line x1="114" y1="68" x2="138" y2="68" stroke="#e6ccb2" stroke-width="2"/>
        <line x1="114" y1="80" x2="138" y2="80" stroke="#e6ccb2" stroke-width="2"/>
        <line x1="182" y1="68" x2="206" y2="68" stroke="#e6ccb2" stroke-width="2"/>
        <line x1="182" y1="80" x2="206" y2="80" stroke="#e6ccb2" stroke-width="2"/>
        <text x="14" y="75" fill="#e6ccb2" font-family="IBM Plex Mono" font-size="8.5">4× 1/4" SDS SCREWS</text>
        <text x="210" y="98" fill="#d4a373" font-family="IBM Plex Mono" font-size="8.5">1" STANDOFF GAP</text>
        <text x="210" y="122" fill="#e07a5f" font-family="IBM Plex Mono" font-size="8.5">5/8"×5" ANCHOR</text>
      </svg>
    `
  },
  J2: {
    code: 'J2 · PRIMARY LOAD TRANSFER',
    title: 'Notched Post-to-Double-Beam Carriage Assembly',
    perJoint: 'Per Post Top',
    hardware: [
      { name: 'Thru-Bolt Carriage / Hex Bolts', spec: '1/2" × 8" Galv + Washers (×4)' },
      { name: 'Steel T-Strap / LPCZ Post Cap', spec: '12-Ga Powder-Coated (×2)' },
      { name: 'Pilot Bore Requirement', spec: '9/16" Auger Bit (3" Stagger)' }
    ],
    steps: [
      'Clamp outer and inner 2×10 drop-beams flush against the post top shoulder.',
      'Bore two staggered 9/16" through-holes per beam face (minimum 2" edge distance).',
      'Drive 1/2"×8" hot-dip galvanized bolts with flat washers; torque to 45 ft-lbs.'
    ],
    svg: `
      <svg viewBox="0 0 320 150" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="150" fill="#08101f"/>
        <rect x="125" y="25" width="70" height="115" fill="rgba(147,197,253,0.09)" stroke="#93c5fd" stroke-width="1.5"/>
        <rect x="25" y="30" width="270" height="48" fill="rgba(147,197,253,0.16)" stroke="#93c5fd" stroke-width="1.6"/>
        <path d="M 115 30 L 205 30 L 205 78 L 185 78 L 185 112 L 135 112 L 135 78 L 115 78 Z" fill="rgba(212,163,115,0.18)" stroke="#d4a373" stroke-width="1.6"/>
        <circle cx="143" cy="45" r="4.5" fill="#d4a373" stroke="#f4f6f8" stroke-width="1"/>
        <circle cx="177" cy="63" r="4.5" fill="#d4a373" stroke="#f4f6f8" stroke-width="1"/>
        <circle cx="148" cy="95" r="4" fill="#e6ccb2" stroke="#f4f6f8" stroke-width="1"/>
        <circle cx="172" cy="95" r="4" fill="#e6ccb2" stroke="#f4f6f8" stroke-width="1"/>
        <line x1="143" y1="45" x2="72" y2="20" stroke="#d4a373" stroke-width="1"/>
        <text x="12" y="17" fill="#e6ccb2" font-family="IBM Plex Mono" font-size="8.5">1/2"×8" THRU-BOLTS (STAGGERED)</text>
        <text x="212" y="98" fill="#d4a373" font-family="IBM Plex Mono" font-size="8.5">12-GA T-PLATE</text>
        <text x="32" y="58" fill="#93c5fd" font-family="IBM Plex Mono" font-size="9">(2) 2×10 HEADER</text>
      </svg>
    `
  },
  J3: {
    code: 'J3 · EXTERIOR WALL ATTACHMENT',
    title: 'Ledger Board Lag Pattern & Joist Hanger',
    perJoint: 'Along House Wall',
    hardware: [
      { name: 'LedgerLok / 1/2"×5" Lag Screws', spec: '16" OC Staggered into Rim' },
      { name: 'Simpson LUS28Z Joist Hanger', spec: '18-Ga ZMAX (1 per Rafter)' },
      { name: 'Weather Flashing Tape', spec: 'Continuous Z-Flashing Cap' }
    ],
    steps: [
      'Locate existing house rim joist; pre-drill 5/16" pilot holes through the ledger.',
      'Install two 1/2"×5" lag screws per stud bay (staggered 2" from top and bottom edges).',
      'Mount LUS28Z hangers flush to bottom of ledger using 10d×1.5" hanger nails.'
    ],
    svg: `
      <svg viewBox="0 0 320 150" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="150" fill="#08101f"/>
        <rect x="20" y="8" width="48" height="134" fill="rgba(148,163,184,0.12)" stroke="#64748b" stroke-width="1.2"/>
        <text x="26" y="132" fill="#8a99ad" font-family="IBM Plex Mono" font-size="8" transform="rotate(-90 34,132)">HOUSE RIM JOIST</text>
        <rect x="68" y="30" width="28" height="86" fill="rgba(147,197,253,0.18)" stroke="#93c5fd" stroke-width="1.6"/>
        <path d="M 66 14 L 66 30 L 98 30 L 98 36" fill="none" stroke="#81b29a" stroke-width="2"/>
        <text x="104" y="24" fill="#81b29a" font-family="IBM Plex Mono" font-size="8.5">Z-FLASHING DRIP CAP</text>
        <line x1="28" y1="50" x2="102" y2="50" stroke="#e07a5f" stroke-width="3.5"/>
        <line x1="28" y1="92" x2="102" y2="92" stroke="#e07a5f" stroke-width="3.5"/>
        <rect x="96" y="34" width="165" height="68" fill="rgba(147,197,253,0.10)" stroke="#93c5fd" stroke-width="1.4"/>
        <path d="M 96 62 L 122 62 L 122 104 L 96 104" fill="rgba(212,163,115,0.22)" stroke="#d4a373" stroke-width="1.6"/>
        <circle cx="110" cy="76" r="2.5" fill="#d4a373"/>
        <circle cx="110" cy="92" r="2.5" fill="#d4a373"/>
        <text x="132" y="64" fill="#93c5fd" font-family="IBM Plex Mono" font-size="9">2×8 RAFTER</text>
        <text x="132" y="94" fill="#d4a373" font-family="IBM Plex Mono" font-size="8.5">LUS28Z HANGER + NAILS</text>
        <text x="132" y="128" fill="#e07a5f" font-family="IBM Plex Mono" font-size="8.5">1/2"×5" LAG SCREWS</text>
      </svg>
    `
  },
  J4: {
    code: 'J4 · WIND UPLIFT TIE-DOWN',
    title: 'Rafter Birdsmouth Seat & Hurricane Tie',
    perJoint: 'Per Rafter Crossing',
    hardware: [
      { name: 'Simpson H2.5AZ Hurricane Tie', spec: '18-Ga ZMAX Uplift Clip' },
      { name: '6" Structural Timber Screw', spec: '1/4" × 6" Countersunk' },
      { name: 'Birdsmouth Seat Cut', spec: '1.5" Heel × 3.5" Bearing' }
    ],
    steps: [
      'Notch 1.5" deep birdsmouth seat on bottom edge of 2×8 rafter so it locks over beam.',
      'Position H2.5AZ hurricane clip straddling rafter face and inner 2×10 beam.',
      'Drive five #9×1.5" connector screws into the beam and five into the rafter.'
    ],
    svg: `
      <svg viewBox="0 0 320 150" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="150" fill="#08101f"/>
        <rect x="115" y="68" width="54" height="68" fill="rgba(147,197,253,0.18)" stroke="#93c5fd" stroke-width="1.6"/>
        <line x1="142" y1="68" x2="142" y2="136" stroke="#93c5fd" stroke-width="1" stroke-dasharray="3,2"/>
        <path d="M 20 26 L 295 26 L 295 76 L 169 76 L 169 68 L 115 68 L 115 76 L 20 76 Z" fill="rgba(147,197,253,0.10)" stroke="#93c5fd" stroke-width="1.5"/>
        <path d="M 169 48 L 185 48 L 185 108 L 169 108 Z" fill="rgba(212,163,115,0.24)" stroke="#d4a373" stroke-width="1.6"/>
        <line x1="130" y1="18" x2="130" y2="104" stroke="#e07a5f" stroke-width="2.5" stroke-dasharray="4,1"/>
        <rect x="125" y="15" width="10" height="4" fill="#e07a5f"/>
        <text x="26" y="48" fill="#93c5fd" font-family="IBM Plex Mono" font-size="9">2×8 RAFTER OVERHANG</text>
        <text x="193" y="88" fill="#d4a373" font-family="IBM Plex Mono" font-size="8.5">H2.5AZ HURRICANE CLIP</text>
        <text x="193" y="104" fill="#8a99ad" font-family="IBM Plex Mono" font-size="8">1.5" BIRDSMOUTH NOTCH</text>
        <text x="148" y="18" fill="#e07a5f" font-family="IBM Plex Mono" font-size="8.5">6" TIMBER SCREW</text>
      </svg>
    `
  }
};
