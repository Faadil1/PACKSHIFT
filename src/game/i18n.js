// Every word the public game shows, in French, English and Spanish.
// Adding a language = adding one object with the same keys (a unit test
// checks that every language has exactly the same shape as French).

export const LANGS = ['fr', 'en', 'es'];
export const LANG_LABEL = { fr: 'FR', en: 'EN', es: 'ES' };
export const LOCALE = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' };
const LANG_KEY = 'packshift.lang';

const plural = (n, one, many) => (n > 1 ? many : one);

const fr = {
  htmlTitle: 'Est-ce que ça rentre ? — PACKSHIFT',
  appTitle: 'Est-ce que ça rentre ?',
  cardTitle: ['EST-CE QUE', 'ÇA RENTRE ?'],
  cardCta: 'À toi de jouer →',
  fileName: 'est-ce-que-ca-rentre.png',
  langNav: 'Langue',

  hook1: ['Tout ce qui est écrit sur une boîte est ', 'obligatoire.'],
  hook2: 'Ou presque.',
  hook3: ['Et il n’y a ', 'pas la place.'],
  play: 'Jouer',
  playSub: '6 niveaux · 3 minutes',
  daily: 'Défi du jour',
  create: 'Crée ta boîte',
  createSub: 'ton slogan rentre ?',
  pro: 'Mode pro →',
  disclaimer: 'Règles simplifiées pour le jeu · pas un avis réglementaire',

  plain: {
    claim: { name: 'Slogan', why: 'Ce qui fait vendre. Il doit être devant, sinon personne ne le voit.' },
    language: { name: 'Traduction', why: 'La loi exige que tout soit écrit dans la langue du pays.' },
    data: { name: 'QR de tri', why: 'Explique comment recycler la boîte. Obligatoire en France.' },
    warning: { name: 'Attention', why: 'Les précautions d’usage : « éviter le contact avec les yeux »…' },
    eco: { name: 'Écolo', why: 'La marque veut montrer que son emballage est plus vert.' },
    barcode: { name: 'Code-barres', why: 'Sans lui, la caisse ne peut pas scanner le produit.' },
  },
  face: { FRONT: 'Devant', LEFT_COPY: 'Gauche', RIGHT_DATA: 'Droite', BACK: 'Dos' },
  already: {
    EU: { FRONT: 'nom + contenance', LEFT_COPY: 'mode d’emploi', RIGHT_DATA: 'n° de lot', BACK: 'ingrédients' },
    CANADA: { FRONT: 'nom + contenance', LEFT_COPY: 'mode d’emploi FR + EN', RIGHT_DATA: 'n° de lot', BACK: 'ingrédients' },
    US: { FRONT: 'nom + 1.7 fl oz / 50 mL', LEFT_COPY: 'mode d’emploi', RIGHT_DATA: 'n° de lot', BACK: 'tableau « facts »' },
  },
  market: { EU: 'en France', CANADA: 'au Canada', US: 'aux États-Unis' },
  rules: {
    sloganFront: 'Le slogan va devant',
    noBarcodeFront: 'Pas de code-barres devant',
    bilingual: 'Tout est écrit en français ET en anglais',
  },
  levels: {
    1: {
      title: 'Le premier pot',
      goal: 'Colle les 3 étiquettes sur la boîte. Rien ne doit déborder.',
      fact: 'Sur une vraie boîte, presque chaque mot est imposé par la loi ou par la marque.',
    },
    2: {
      title: 'Direction le Canada',
      goal: 'Même boîte, mais au Canada. Attention : la gauche est déjà pleine.',
      fact: 'Au Canada, les mentions sont bilingues : le même texte prend deux fois plus de place.',
    },
    3: {
      title: 'Tout le monde veut être vu',
      goal: '6 étiquettes, 4 faces. Trouve la place de chacune.',
      fact: 'Le code-barres est presque toujours au dos : devant, il gâcherait la vitrine.',
    },
    4: {
      title: 'Nouvelle loi !',
      goal: 'Au Canada. Colle les 4 étiquettes… et tiens-toi prêt.',
      fact: 'Les règles d’étiquetage changent souvent : à chaque nouvelle loi, des milliers de boîtes doivent être redessinées.',
    },
    5: {
      title: 'La marque veut plus petit',
      goal: 'Moins de carton = moins cher et plus écolo. Rétrécis la boîte au maximum, sans que rien ne déborde.',
      fact: 'Chaque millimètre de carton économisé, multiplié par des millions de boîtes, compte.',
    },
    6: {
      title: 'Mission impossible ?',
      goal: '6 étiquettes, au Canada. Essaie… puis agrandis la boîte le moins possible.',
      fact: 'Voilà pourquoi certaines boîtes sont plus grandes que le pot : il faut de la place pour tout ce qu’on est obligé d’écrire.',
    },
    daily: {
      title: (date) => `Défi du ${date}`,
      goal: (where) => `La boîte la plus serrée possible, ${where}. Tout le monde a la même aujourd’hui.`,
      fact: 'Demain, un nouveau défi. Même boîte pour tout le monde : compare tes coups.',
    },
    boite: {
      title: 'Ta boîte',
      goal: 'Invente ton produit. Si ton slogan est trop long… il ne rentrera pas.',
      fact: 'Les slogans courts ne sont pas qu’une mode : la face avant est minuscule.',
    },
  },

  back: 'Retour à l’accueil',
  levelsNav: 'Niveaux',
  levelAria: (n, title) => `Niveau ${n} : ${title}`,
  dayShort: 'Jour',
  moves: (n) => plural(n, 'coup', 'coups'),
  soundOn: 'Son actif',
  soundOff: 'Son coupé',
  kickerLevel: (n, total) => `Niveau ${n} / ${total}`,
  rival: (moves, extra) => `Ton ami·e a réussi en ${moves} ${plural(moves, 'coup', 'coups')} ${extra}. À toi.`,
  rivalSize: (size) => `avec une boîte de ${size}`,
  rivalTime: (time) => `et ${time}`,
  productName: 'Nom du produit',
  yourSlogan: 'Ton slogan',
  sloganPlaceholder: 'Ex. : Doux comme un nuage',
  defaultBrand: { name: 'Ma crème', slogan: 'Hydrate 24h' },
  boxTagline: 'CRÈME · 50 mL',
  loading: 'La boîte arrive…',
  facesHead: ['Les 4 faces de la boîte', 'la jauge = la place déjà prise'],
  alreadyPrinted: 'déjà imprimé :',
  toStick: (n) => `À coller (${n})`,
  allStuck: 'Tout est collé',
  hint: 'Indice',
  tapFace: 'Touche une face pour la coller.',
  boxSize: 'Taille de la boîte',
  finalSize: 'C’est ma taille finale',
  validateBox: 'Valider ma boîte',
  restart: 'Recommencer',
  share: 'Partager',
  myScore: 'Mon score',
  unstick: 'décoller',
  charAria: (name) => `${name}. Glisse-le sur une face, ou appuie sur Entrée puis choisis une face.`,

  status: {
    impossibleShrink: 'Trop petit : rien ne marche à cette taille.',
    impossibleGrow: 'Aucun rangement ne marche à cette taille. Agrandis la boîte ↓',
    sloganFront: 'Le slogan doit être devant, sinon personne ne le voit.',
    barcodeFront: 'Pas de code-barres devant : ça gâche la vitrine.',
    growHint: (f) => `${f} déborde encore… et si la boîte était plus grande ?`,
    sloganNever: 'Ton slogan est trop long pour n’importe quelle boîte. Raccourcis-le !',
    sloganLong: 'Ton slogan prend trop de place devant. Raccourcis-le, ou agrandis la boîte.',
    overflow: (f) => `Ça déborde : ${f} !`,
    start: 'Glisse une étiquette sur une face (ou touche-la, puis touche une face).',
    remaining: (n) => `Encore ${n} ${plural(n, 'étiquette', 'étiquettes')} à coller.`,
    shrinkMore: 'Ça rentre. Peux-tu rétrécir encore ?',
    shrinkFinal: 'Ça rentre. C’est ta taille finale ?',
    growSmaller: 'Ça rentre ! Mais une boîte plus petite marcherait-elle ?',
    growFinal: 'Ça rentre ! C’est ta taille finale ?',
    sandboxOk: 'Ça rentre ! Valide ta boîte.',
    ok: 'Ça rentre !',
  },
  twist: {
    stamp: 'NOUVELLE LOI',
    body: 'Au Canada, tout doit maintenant être écrit en français ET en anglais. La traduction arrive : trouve-lui une place.',
    newTag: 'nouveau',
  },
  popped: (name, face) => `Plus de place sur ${face} ! ${name} → retour au bac.`,
  poppedGrow: 'Ça retombe encore… et si la boîte était plus grande ? ↓',
  dice: 'Slogan au hasard',
  slogans: [
    'Doux.',
    'Hydrate 24h',
    'Zéro compromis',
    'Peau de bébé garantie',
    'Le nuage qui s’applique',
    'Testé sous contrôle dermatologique',
    'La crème que ta grand-mère t’aurait volée',
    'Fabriqué avec amour et un peu de glycérine',
    'Nouvelle formule, encore plus nouvelle que l’ancienne',
    'Hydratation intense, fraîche, profonde et durable toute la journée',
  ],
  notes: { dragMe: 'glisse-moi devant ↗', notSeen: 'on ne me voit pas !', notHere: 'pas ici !', noRoom: 'je rentre pas !' },
  hintFlash: { sizing: 'Aucun rangement ne marche à cette taille. Change la taille de la boîte.', none: 'Même la meilleure solution déborde ici.' },

  win: {
    aria: 'Gagné',
    fits: 'Ça rentre !',
    brandFits: (name) => `« ${name || 'Ton produit'} » rentre !`,
    starsAria: (n) => `${n} étoiles sur 3`,
    score: (moves, time, size) => `${moves} ${plural(moves, 'coup', 'coups')} · ${time} · boîte de ${size}`,
    record: (size) => `Le record possible : ${size}`,
    beat: 'Tu bats ton ami·e. Renvoie-lui le défi !',
    lost: 'Ton ami·e reste devant… cette fois.',
    shareScore: 'Partager mon score',
    challenge: 'Défier quelqu’un',
    next: 'Niveau suivant →',
    dailyArrow: 'Défi du jour →',
    createArrow: 'Crée ta boîte →',
    seeBox: 'voir la boîte',
  },
  card: {
    brandFits: (name) => `« ${name || 'Mon produit'} » rentre !`,
    sloganNever: 'Mon slogan ne rentre nulle part',
    notYetBrand: 'Ça ne rentre pas… encore',
    solved: (n) => `Rangé en ${n} ${plural(n, 'coup', 'coups')}`,
    notYet: 'Pas encore',
    detailBrand: (slogan, len, size) => `« ${slogan} » · ${len} caractères · boîte de ${size}`,
    detail: (n, size, time) => `${n} mentions obligatoires · boîte de ${size}${time ? ' · ' + time : ''}`,
    kickerLevel: (n, title) => `Niveau ${n} · ${title}`,
    textLevel: (n) => `Niveau ${n}`,
    textMoves: (n, size) => `${n} ${plural(n, 'coup', 'coups')} · ${size}`,
  },
  toast: {
    downloadedCopied: 'Image téléchargée · texte et lien copiés',
    copied: 'Texte et lien copiés',
    downloaded: 'Image téléchargée',
    copyPrompt: 'Copie ce texte',
    challengeCopied: 'Lien du défi copié. Envoie-le à quelqu’un !',
    linkPrompt: 'Copie ce lien',
  },
};

const en = {
  htmlTitle: 'Does it fit? — PACKSHIFT',
  appTitle: 'Does it fit?',
  cardTitle: ['DOES IT', 'FIT?'],
  cardCta: 'Your turn →',
  fileName: 'does-it-fit.png',
  langNav: 'Language',

  hook1: ['Everything written on a box is ', 'mandatory.'],
  hook2: 'Well, almost.',
  hook3: ['And there’s ', 'no room.'],
  play: 'Play',
  playSub: '6 levels · 3 minutes',
  daily: 'Daily challenge',
  create: 'Make your box',
  createSub: 'does your slogan fit?',
  pro: 'Pro mode →',
  disclaimer: 'Rules simplified for the game · not regulatory advice',

  plain: {
    claim: { name: 'Slogan', why: 'What sells it. It has to be on the front, or nobody sees it.' },
    language: { name: 'Translation', why: 'The law says everything must be in the country’s language.' },
    data: { name: 'Recycling QR', why: 'Tells you how to recycle the box. Mandatory in France.' },
    warning: { name: 'Warning', why: 'Safety instructions: “avoid contact with eyes”…' },
    eco: { name: 'Eco', why: 'The brand wants to show its packaging is greener.' },
    barcode: { name: 'Barcode', why: 'Without it, the checkout can’t scan the product.' },
  },
  face: { FRONT: 'Front', LEFT_COPY: 'Left', RIGHT_DATA: 'Right', BACK: 'Back' },
  already: {
    EU: { FRONT: 'name + volume', LEFT_COPY: 'directions', RIGHT_DATA: 'batch no.', BACK: 'ingredients' },
    CANADA: { FRONT: 'name + volume', LEFT_COPY: 'directions EN + FR', RIGHT_DATA: 'batch no.', BACK: 'ingredients' },
    US: { FRONT: 'name + 1.7 fl oz / 50 mL', LEFT_COPY: 'directions', RIGHT_DATA: 'batch no.', BACK: '“facts” panel' },
  },
  market: { EU: 'in France', CANADA: 'in Canada', US: 'in the US' },
  rules: {
    sloganFront: 'Slogan goes on the front',
    noBarcodeFront: 'No barcode on the front',
    bilingual: 'Everything in French AND English',
  },
  levels: {
    1: {
      title: 'The first jar',
      goal: 'Stick the 3 labels on the box. Nothing may overflow.',
      fact: 'On a real box, almost every word is required by law or by the brand.',
    },
    2: {
      title: 'Next stop: Canada',
      goal: 'Same box, but in Canada. Careful: the left side is already full.',
      fact: 'In Canada, labels are bilingual: the same text takes twice the room.',
    },
    3: {
      title: 'Everyone wants to be seen',
      goal: '6 labels, 4 sides. Find a place for each one.',
      fact: 'The barcode is almost always on the back: on the front it would spoil the shop window.',
    },
    4: {
      title: 'New law!',
      goal: 'In Canada. Stick the 4 labels… and brace yourself.',
      fact: 'Labelling rules change often: every new law means thousands of boxes get redesigned.',
    },
    5: {
      title: 'The brand wants it smaller',
      goal: 'Less cardboard = cheaper and greener. Shrink the box as far as you can without anything overflowing.',
      fact: 'Every millimetre of cardboard saved, times millions of boxes, adds up.',
    },
    6: {
      title: 'Mission impossible?',
      goal: '6 labels, in Canada. Try it… then make the box as little bigger as you can.',
      fact: 'That’s why some boxes are bigger than the jar: they need room for everything they’re required to say.',
    },
    daily: {
      title: (date) => `Challenge of ${date}`,
      goal: (where) => `The tightest box possible, ${where}. Everyone gets the same one today.`,
      fact: 'A new challenge tomorrow. Same box for everyone: compare your moves.',
    },
    boite: {
      title: 'Your box',
      goal: 'Invent your product. If your slogan is too long… it won’t fit.',
      fact: 'Short slogans aren’t just a trend: the front of a box is tiny.',
    },
  },

  back: 'Back to home',
  levelsNav: 'Levels',
  levelAria: (n, title) => `Level ${n}: ${title}`,
  dayShort: 'Day',
  moves: (n) => plural(n, 'move', 'moves'),
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  kickerLevel: (n, total) => `Level ${n} / ${total}`,
  rival: (moves, extra) => `Your friend did it in ${moves} ${plural(moves, 'move', 'moves')} ${extra}. Your turn.`,
  rivalSize: (size) => `with a ${size} box`,
  rivalTime: (time) => `and ${time}`,
  productName: 'Product name',
  yourSlogan: 'Your slogan',
  sloganPlaceholder: 'E.g. Soft as a cloud',
  defaultBrand: { name: 'My cream', slogan: '24h hydration' },
  boxTagline: 'CREAM · 50 mL',
  loading: 'Here comes the box…',
  facesHead: ['The 4 sides of the box', 'the gauge = space already used'],
  alreadyPrinted: 'already printed:',
  toStick: (n) => `To stick (${n})`,
  allStuck: 'Everything is stuck',
  hint: 'Hint',
  tapFace: 'Tap a side to stick it.',
  boxSize: 'Box size',
  finalSize: 'That’s my final size',
  validateBox: 'Confirm my box',
  restart: 'Restart',
  share: 'Share',
  myScore: 'My score',
  unstick: 'unstick',
  charAria: (name) => `${name}. Drag it onto a side, or press Enter then choose a side.`,

  status: {
    impossibleShrink: 'Too small: nothing works at this size.',
    impossibleGrow: 'No layout works at this size. Make the box bigger ↓',
    sloganFront: 'The slogan has to be on the front, or nobody sees it.',
    barcodeFront: 'No barcode on the front: it spoils the shop window.',
    growHint: (f) => `${f} still overflows… what if the box were bigger?`,
    sloganNever: 'Your slogan is too long for any box. Shorten it!',
    sloganLong: 'Your slogan takes too much room on the front. Shorten it, or make the box bigger.',
    overflow: (f) => `Overflow: ${f}!`,
    start: 'Drag a label onto a side (or tap it, then tap a side).',
    remaining: (n) => `${n} more ${plural(n, 'label', 'labels')} to stick.`,
    shrinkMore: 'It fits. Can you shrink it more?',
    shrinkFinal: 'It fits. Is that your final size?',
    growSmaller: 'It fits! But would a smaller box work?',
    growFinal: 'It fits! Is that your final size?',
    sandboxOk: 'It fits! Confirm your box.',
    ok: 'It fits!',
  },
  twist: {
    stamp: 'NEW LAW',
    body: 'In Canada, everything must now be in French AND English. The translation is here: find it a spot.',
    newTag: 'new',
  },
  popped: (name, face) => `No room on ${face}! ${name} bounced back.`,
  poppedGrow: 'It keeps falling off… what if the box were bigger? ↓',
  dice: 'Random slogan',
  slogans: [
    'Soft.',
    '24h hydration',
    'Zero compromise',
    'Baby-soft skin, guaranteed',
    'A cloud you can apply',
    'Dermatologically tested',
    'The cream your grandma would steal',
    'Made with love and a little glycerin',
    'New formula, even newer than the old one',
    'Intense, fresh, deep and long-lasting hydration all day long',
  ],
  notes: { dragMe: 'drag me to the front ↗', notSeen: 'nobody can see me!', notHere: 'not here!', noRoom: 'I don’t fit!' },
  hintFlash: { sizing: 'No layout works at this size. Change the box size.', none: 'Even the best layout overflows here.' },

  win: {
    aria: 'You won',
    fits: 'It fits!',
    brandFits: (name) => `“${name || 'Your product'}” fits!`,
    starsAria: (n) => `${n} stars out of 3`,
    score: (moves, time, size) => `${moves} ${plural(moves, 'move', 'moves')} · ${time} · ${size} box`,
    record: (size) => `Best possible: ${size}`,
    beat: 'You beat your friend. Send the challenge back!',
    lost: 'Your friend stays ahead… this time.',
    shareScore: 'Share my score',
    challenge: 'Challenge someone',
    next: 'Next level →',
    dailyArrow: 'Daily challenge →',
    createArrow: 'Make your box →',
    seeBox: 'see the box',
  },
  card: {
    brandFits: (name) => `“${name || 'My product'}” fits!`,
    sloganNever: 'My slogan fits nowhere',
    notYetBrand: 'Doesn’t fit… yet',
    solved: (n) => `Done in ${n} ${plural(n, 'move', 'moves')}`,
    notYet: 'Not yet',
    detailBrand: (slogan, len, size) => `“${slogan}” · ${len} characters · ${size} box`,
    detail: (n, size, time) => `${n} mandatory labels · ${size} box${time ? ' · ' + time : ''}`,
    kickerLevel: (n, title) => `Level ${n} · ${title}`,
    textLevel: (n) => `Level ${n}`,
    textMoves: (n, size) => `${n} ${plural(n, 'move', 'moves')} · ${size}`,
  },
  toast: {
    downloadedCopied: 'Image downloaded · text and link copied',
    copied: 'Text and link copied',
    downloaded: 'Image downloaded',
    copyPrompt: 'Copy this text',
    challengeCopied: 'Challenge link copied. Send it to someone!',
    linkPrompt: 'Copy this link',
  },
};

const es = {
  htmlTitle: '¿Cabe o no cabe? — PACKSHIFT',
  appTitle: '¿Cabe o no cabe?',
  cardTitle: ['¿CABE O', 'NO CABE?'],
  cardCta: 'Te toca →',
  fileName: 'cabe-o-no-cabe.png',
  langNav: 'Idioma',

  hook1: ['Todo lo que está escrito en una caja es ', 'obligatorio.'],
  hook2: 'Bueno, casi.',
  hook3: ['Y no hay ', 'sitio.'],
  play: 'Jugar',
  playSub: '6 niveles · 3 minutos',
  daily: 'Reto del día',
  create: 'Crea tu caja',
  createSub: '¿cabe tu eslogan?',
  pro: 'Modo pro →',
  disclaimer: 'Reglas simplificadas para el juego · no es asesoría normativa',

  plain: {
    claim: { name: 'Eslogan', why: 'Lo que hace vender. Tiene que ir delante, si no nadie lo ve.' },
    language: { name: 'Traducción', why: 'La ley exige que todo esté escrito en el idioma del país.' },
    data: { name: 'QR de reciclaje', why: 'Explica cómo reciclar la caja. Obligatorio en Francia.' },
    warning: { name: 'Atención', why: 'Las precauciones de uso: «evitar el contacto con los ojos»…' },
    eco: { name: 'Eco', why: 'La marca quiere mostrar que su envase es más verde.' },
    barcode: { name: 'Código de barras', why: 'Sin él, la caja registradora no puede escanear el producto.' },
  },
  face: { FRONT: 'Delante', LEFT_COPY: 'Izquierda', RIGHT_DATA: 'Derecha', BACK: 'Detrás' },
  already: {
    EU: { FRONT: 'nombre + contenido', LEFT_COPY: 'modo de empleo', RIGHT_DATA: 'n.º de lote', BACK: 'ingredientes' },
    CANADA: { FRONT: 'nombre + contenido', LEFT_COPY: 'modo de empleo FR + EN', RIGHT_DATA: 'n.º de lote', BACK: 'ingredientes' },
    US: { FRONT: 'nombre + 1.7 fl oz / 50 mL', LEFT_COPY: 'modo de empleo', RIGHT_DATA: 'n.º de lote', BACK: 'tabla «facts»' },
  },
  market: { EU: 'en Francia', CANADA: 'en Canadá', US: 'en EE. UU.' },
  rules: {
    sloganFront: 'El eslogan va delante',
    noBarcodeFront: 'Nada de código de barras delante',
    bilingual: 'Todo en francés Y en inglés',
  },
  levels: {
    1: {
      title: 'El primer tarro',
      goal: 'Pega las 3 etiquetas en la caja. Nada puede desbordarse.',
      fact: 'En una caja real, casi cada palabra la impone la ley o la marca.',
    },
    2: {
      title: 'Rumbo a Canadá',
      goal: 'La misma caja, pero en Canadá. Ojo: la izquierda ya está llena.',
      fact: 'En Canadá los textos son bilingües: lo mismo ocupa el doble.',
    },
    3: {
      title: 'Todos quieren que los vean',
      goal: '6 etiquetas, 4 caras. Encuentra el sitio de cada una.',
      fact: 'El código de barras casi siempre va detrás: delante estropearía el escaparate.',
    },
    4: {
      title: '¡Nueva ley!',
      goal: 'En Canadá. Pega las 4 etiquetas… y prepárate.',
      fact: 'Las normas de etiquetado cambian a menudo: con cada ley nueva, miles de cajas se rediseñan.',
    },
    5: {
      title: 'La marca la quiere más pequeña',
      goal: 'Menos cartón = más barato y más ecológico. Encoge la caja al máximo sin que nada se desborde.',
      fact: 'Cada milímetro de cartón ahorrado, multiplicado por millones de cajas, cuenta.',
    },
    6: {
      title: '¿Misión imposible?',
      goal: '6 etiquetas, en Canadá. Inténtalo… y luego agranda la caja lo menos posible.',
      fact: 'Por eso algunas cajas son más grandes que el tarro: hace falta sitio para todo lo que es obligatorio escribir.',
    },
    daily: {
      title: (date) => `Reto del ${date}`,
      goal: (where) => `La caja más ajustada posible, ${where}. Hoy todo el mundo tiene la misma.`,
      fact: 'Mañana, un reto nuevo. La misma caja para todos: compara tus movimientos.',
    },
    boite: {
      title: 'Tu caja',
      goal: 'Inventa tu producto. Si tu eslogan es demasiado largo… no cabrá.',
      fact: 'Los eslóganes cortos no son solo una moda: la cara delantera es minúscula.',
    },
  },

  back: 'Volver al inicio',
  levelsNav: 'Niveles',
  levelAria: (n, title) => `Nivel ${n}: ${title}`,
  dayShort: 'Día',
  moves: (n) => plural(n, 'movimiento', 'movimientos'),
  soundOn: 'Sonido activado',
  soundOff: 'Sonido desactivado',
  kickerLevel: (n, total) => `Nivel ${n} / ${total}`,
  rival: (moves, extra) => `Tu amigo/a lo logró en ${moves} ${plural(moves, 'movimiento', 'movimientos')} ${extra}. Te toca.`,
  rivalSize: (size) => `con una caja de ${size}`,
  rivalTime: (time) => `y ${time}`,
  productName: 'Nombre del producto',
  yourSlogan: 'Tu eslogan',
  sloganPlaceholder: 'Ej.: Suave como una nube',
  defaultBrand: { name: 'Mi crema', slogan: 'Hidrata 24h' },
  boxTagline: 'CREMA · 50 mL',
  loading: 'Llega la caja…',
  facesHead: ['Las 4 caras de la caja', 'el indicador = el sitio ya ocupado'],
  alreadyPrinted: 'ya impreso:',
  toStick: (n) => `Por pegar (${n})`,
  allStuck: 'Todo pegado',
  hint: 'Pista',
  tapFace: 'Toca una cara para pegarla.',
  boxSize: 'Tamaño de la caja',
  finalSize: 'Es mi tamaño final',
  validateBox: 'Confirmar mi caja',
  restart: 'Reiniciar',
  share: 'Compartir',
  myScore: 'Mi puntuación',
  unstick: 'despegar',
  charAria: (name) => `${name}. Arrástrala a una cara, o pulsa Intro y elige una cara.`,

  status: {
    impossibleShrink: 'Demasiado pequeña: nada funciona con este tamaño.',
    impossibleGrow: 'Ninguna colocación funciona con este tamaño. Agranda la caja ↓',
    sloganFront: 'El eslogan tiene que ir delante, si no nadie lo ve.',
    barcodeFront: 'Nada de código de barras delante: estropea el escaparate.',
    growHint: (f) => `${f} sigue desbordándose… ¿y si la caja fuera más grande?`,
    sloganNever: 'Tu eslogan es demasiado largo para cualquier caja. ¡Acórtalo!',
    sloganLong: 'Tu eslogan ocupa demasiado delante. Acórtalo o agranda la caja.',
    overflow: (f) => `¡Se desborda: ${f}!`,
    start: 'Arrastra una etiqueta a una cara (o tócala y luego toca una cara).',
    remaining: (n) => `${plural(n, 'Queda', 'Quedan')} ${n} ${plural(n, 'etiqueta', 'etiquetas')} por pegar.`,
    shrinkMore: 'Cabe. ¿Puedes encogerla más?',
    shrinkFinal: 'Cabe. ¿Es tu tamaño final?',
    growSmaller: '¡Cabe! ¿Pero funcionaría una caja más pequeña?',
    growFinal: '¡Cabe! ¿Es tu tamaño final?',
    sandboxOk: '¡Cabe! Confirma tu caja.',
    ok: '¡Cabe!',
  },
  twist: {
    stamp: 'NUEVA LEY',
    body: 'En Canadá, ahora todo debe estar en francés Y en inglés. Llega la traducción: búscale un sitio.',
    newTag: 'nuevo',
  },
  popped: (name, face) => `¡No hay sitio en ${face}! ${name} vuelve a la bandeja.`,
  poppedGrow: 'Se sigue cayendo… ¿y si la caja fuera más grande? ↓',
  dice: 'Eslogan al azar',
  slogans: [
    'Suave.',
    'Hidrata 24h',
    'Cero compromisos',
    'Piel de bebé garantizada',
    'Una nube que se aplica',
    'Testado dermatológicamente',
    'La crema que tu abuela te robaría',
    'Hecha con amor y un poco de glicerina',
    'Nueva fórmula, aún más nueva que la anterior',
    'Hidratación intensa, fresca, profunda y duradera todo el día',
  ],
  notes: { dragMe: 'llévame delante ↗', notSeen: '¡nadie me ve!', notHere: '¡aquí no!', noRoom: '¡no quepo!' },
  hintFlash: { sizing: 'Ninguna colocación funciona con este tamaño. Cambia el tamaño de la caja.', none: 'Aquí hasta la mejor solución se desborda.' },

  win: {
    aria: 'Ganaste',
    fits: '¡Cabe!',
    brandFits: (name) => `¡«${name || 'Tu producto'}» cabe!`,
    starsAria: (n) => `${n} estrellas de 3`,
    score: (moves, time, size) => `${moves} ${plural(moves, 'movimiento', 'movimientos')} · ${time} · caja de ${size}`,
    record: (size) => `El récord posible: ${size}`,
    beat: 'Le ganas a tu amigo/a. ¡Devuélvele el reto!',
    lost: 'Tu amigo/a sigue delante… esta vez.',
    shareScore: 'Compartir mi puntuación',
    challenge: 'Retar a alguien',
    next: 'Siguiente nivel →',
    dailyArrow: 'Reto del día →',
    createArrow: 'Crea tu caja →',
    seeBox: 'ver la caja',
  },
  card: {
    brandFits: (name) => `¡«${name || 'Mi producto'}» cabe!`,
    sloganNever: 'Mi eslogan no cabe en ninguna parte',
    notYetBrand: 'No cabe… todavía',
    solved: (n) => `Hecho en ${n} ${plural(n, 'movimiento', 'movimientos')}`,
    notYet: 'Todavía no',
    detailBrand: (slogan, len, size) => `«${slogan}» · ${len} caracteres · caja de ${size}`,
    detail: (n, size, time) => `${n} menciones obligatorias · caja de ${size}${time ? ' · ' + time : ''}`,
    kickerLevel: (n, title) => `Nivel ${n} · ${title}`,
    textLevel: (n) => `Nivel ${n}`,
    textMoves: (n, size) => `${n} ${plural(n, 'movimiento', 'movimientos')} · ${size}`,
  },
  toast: {
    downloadedCopied: 'Imagen descargada · texto y enlace copiados',
    copied: 'Texto y enlace copiados',
    downloaded: 'Imagen descargada',
    copyPrompt: 'Copia este texto',
    challengeCopied: 'Enlace del reto copiado. ¡Envíaselo a alguien!',
    linkPrompt: 'Copia este enlace',
  },
};

export const STRINGS = { fr, en, es };

export function isLang(value) {
  return LANGS.includes(value);
}

// Explicit ?lang= > the viewer's own saved choice > their browser language >
// the language of the link they were sent > English.
export function detectLang({ search = '', linkLang = null, stored = null, navigatorLangs = [] } = {}) {
  const q = new URLSearchParams(search).get('lang');
  if (isLang(q)) return q;
  if (isLang(stored)) return stored;
  for (const tag of navigatorLangs) {
    const base = String(tag || '').slice(0, 2).toLowerCase();
    if (isLang(base)) return base;
  }
  if (isLang(linkLang)) return linkLang;
  return 'en';
}

export function readStoredLang() {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

export function storeLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* not kept in private mode */
  }
}

export function formatCm(mm, lang = 'fr') {
  return (mm / 10).toLocaleString(LOCALE[lang] || 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' cm';
}

// Localised copy for a level object from levels.js.
export function levelText(level, lang = 'fr') {
  const T = STRINGS[lang] || STRINGS.fr;
  const L = T.levels[level.id];
  const rules = [];
  if (level.kinds.includes('claim')) rules.push(T.rules.sloganFront);
  if (level.kinds.includes('barcode')) rules.push(T.rules.noBarcodeFront);
  if (level.market === 'CANADA' && level.twist !== 'language') rules.push(T.rules.bilingual);
  if (level.id === 'daily') {
    const date = new Date(Number(level.key.slice(0, 4)), Number(level.key.slice(4, 6)) - 1, Number(level.key.slice(6, 8)));
    const pretty = date.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short' });
    return { title: L.title(pretty), goal: L.goal(T.market[level.market]), fact: L.fact, rules, date: pretty };
  }
  return { title: L.title, goal: L.goal, fact: L.fact, rules };
}
