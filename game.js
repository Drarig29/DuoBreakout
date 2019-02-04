/* ---------------------------------- [ GESTION DES FICHIERS ] --------------------------------------- */


/* ------------ GAME_CONFIG ------------- */

//la game_config stocke les meilleurs scores et le niveau actuellement choisi pour garder une trace de chaque exécution
var game_config, game_config_filename = "duo_breakout.config";

//ceci est le nom de fichier du niveau 1 qui sera créé par défaut à chaque setup() général ou chaque lancement du jeu (si le fichier n'existe pas)
//il y a donc forcément 1 fichier à utiliser
var level_one_filename = "1.level";

function loadConfigFile() {
  //si le fichier game_config n'existe pas, on le crée (première utilisation)
  if (!window.localStorage[game_config_filename]) {
    game_config = {
      best_scores: [],
      selectedLevelFilename: level_one_filename
    };

    saveConfigFile();
    return;
  }

  //désérialisation JSON
  game_config = JSON.parse(readFile(game_config_filename));
}

function saveConfigFile() {
  //sérialisation JSON pour sauvegarder l'objet configuration dans le fichier
  writeFile(game_config_filename, JSON.stringify(game_config));
}

/* ------------ FICHIERS DE NIVEAUX ------------- */

// Paramètres que l'utilisateur peut modifier : brick_area_margin, max_brick_count, ball_speed, racket_length, bricks

function getBricksArray(size_x, size_y) {
  var bricks = [];

  for (var i = 0; i < size_y; i++) {
    bricks[i] = [];
  }

  //tableaux de 8 * 5 briques rouges, à taper une fois
  for (var y = 0; y < size_y; y++) {
    for (var x = 0; x < size_x; x++) {
      bricks[y][x] = {
        //teinte de la brique en HSB (ici, 0 = rouge), en degrés (de 0 à 360)
        color_hue: 0,
        //représente le nombre de fois qu'il reste à taper la brique pour la casser (si = 0 --> brique inexistante)
        state: 1
      };
    }
  }

  return bricks;
}

function getLevelFileList() {
  var list = [];

  for (var p in window.localStorage) { //code récupéré depuis Algoscript
    if (SousChaine(p, 0, Longueur('dropbox-auth')) != 'dropbox-auth' && typeof(window.localStorage[p]) == 'string' && p.indexOf(".level") != -1) {
      list.push(p);
    }
  }

  list.sort(sortLevels); //cette fonction de tri met les noms de fichiers alphanumériques en premier (triés alphabétiquement) et les numériques après (tri dans l'ordre croissant)
  return list;
}

function getCurrentLevelIndex() {
  var list = getLevelFileList();
  var index = 0;

  for (var i = 0; i < list.length; i++) {
    if (list[i] == current_level_filename) {
      index = i;
      break; //on arrête la boucle si on a trouvé le fichier, rien ne sert de continuer
    }
  }

  return index; //si le niveau actuel n'a pas été trouvé, on retourne 0
}

function selectNextLevel() {
  var list = getLevelFileList();
  var index = 0;

  for (var i = 0; i < list.length; i++) {
    if (list[i] == current_level_filename) {
      index = i;
      break; //même remarque que la fonction précédente
    }
  }

  //si l'index trouvé n'est pas à la fin de la liste, on prend le suivant
  if (index < list.length - 1) {
    index++;
  } else { //sinon on revient au début
    index = 0;
  }

  current_level_filename = list[index];
  current_level_config = readLevelFile(current_level_filename);
}

//le 'DefaultLevel' correspond au niveau créé par défaut à l'ouverture du jeu et à la création d'un nouveau niveau avec l'éditeur

function getDefaultLevel() {
  var max_brick_count = {
    x: 8,
    y: 5
  };

  return {
    brick_area_margin: {
      left: 650,
      top: 150,
      right: 650,
      bottom: 150
    },
    max_brick_count: max_brick_count,
    ball_speed: 10,
    racket_length: 100,
    bricks: getBricksArray(max_brick_count.x, max_brick_count.y)
  };
}

//cette fonction est utilisée quand aucun niveau n'est disponible et que l'on veut créer (et enregistrer) le niveau 1

function createLevelOne() {
  var config = getDefaultLevel();
  saveLevelFile(level_one_filename, config);
  return config;
}

//utilisation de la sérialisation et désérialisation JSON pour stocker les configurations des niveaux

function readLevelFile(filename) {
  return JSON.parse(readFile(filename));
}

function saveLevelFile(filename, config) {
  writeFile(filename, JSON.stringify(config));
}


/* --------------------------------- [ INTERFACE UTILISATEUR ] --------------------------------------- */


/* Cette variable est utilisée par les 2 éléments de l'UI qui changent le curseur : Anchor et ColorPicker.
Elle sert à éviter les conflits entre les changements de curseur. Chaque élément peut changer le curseur uniquement si c'est lui qui l'utilise.
L'éditeur de niveau se charge de remettre le curseur par défaut quand le curseur n'est plus utilisé par un des éléments (si cursor_locked_by = undefined) */
var cursor_locked_by;

var direction = {
  HORIZONTAL: 0,
  VERTICAL: 1
};

function Anchor(dir) {
  this.x = 0;
  this.y = 0;

  //pour ces deux variables, on ne parle pas de largeur ou de hauteur, mais d'épaisseur et de longueur car on ne sait pas encore dans quelle orientation l'Anchor sera...
  this.thickness = 10;
  this.length = 50;

  if (dir == direction.HORIZONTAL) {
    this.width = this.thickness;
    this.height = this.length;
    this.y = (canvas_height - this.height) / 2;
    this.cursor = "e-resize";
    this.moveDirection = direction.HORIZONTAL;
  } else if (dir == direction.VERTICAL) {
    this.width = this.length;
    this.height = this.thickness;
    this.x = (canvas_width - this.width) / 2;
    this.cursor = "n-resize";
    this.moveDirection = direction.VERTICAL;
  }

  this.onValueChanged = function(value) {};

  this.setMinMax = function(min, max) {
    this.min = min;
    this.max = max;
  };

  this.isPointInAnchor = function(x, y) {
    return isPointInRect(x, y, this.x, this.y, this.width, this.height);
  };

  this.handleMouseEvent = function(e) {
    var in_anchor = this.isPointInAnchor(mouseX, mouseY);

    if (in_anchor && e.type == "mousedown") {
      cursor_locked_by = this;
      this.onMouseDown(mouseX, mouseY);
    }

    if (e.type == "mouseup") {
      if (cursor_locked_by == this) {
        if (!in_anchor) GEBID("mycanvas").style.cursor = "";
        //ce n'est pas anchor elle-même qui remet cursor_locked_by à undefined mais le LevelEditor lui-même, comme ça il peut faire ce qu'il veut...
      }
      this.onMouseUp(mouseX, mouseY);
    }

    if (e.type == "mousemove") {
      if (!locked && in_anchor) GEBID("mycanvas").style.cursor = this.cursor;
      this.onMouseMove(mouseX, mouseY);
    }
  };

  var point_down, pos_down;

  var locked = false;

  this.onMouseDown = function(x, y) {
    point_down = { //le point de référence du drag and drop
      x: x,
      y: y
    };

    pos_down = { //la position de référence
      x: this.x,
      y: this.y
    };

    locked = true;
  };

  this.onMouseUp = function(x, y) {
    locked = false;
  };

  this.onMouseMove = function(x, y) {
    if (!locked) return; //on ignore l'évènement s'il n'y a pas de drag and drop
    if (this.moveDirection == direction.HORIZONTAL) {
      this.x = constrain(pos_down.x + x - point_down.x, this.min, this.max); //on empêche la position de dépasser des valeurs min et max
      this.onValueChanged(this.x);
    } else if (this.moveDirection == direction.VERTICAL) {
      this.y = constrain(pos_down.y + y - point_down.y, this.min, this.max);
      this.onValueChanged(this.y);
    }
  };

  this.draw = function() {
    RectanglePlein(this.x, this.y, this.width, this.height, rgb(96, 125, 139));
  };
}

function ColorPicker() {
  this.width = 300;
  this.height = 20;
  this.selectedColorHue = 0;

  function isPointInCircle(x, y, circle_pos, radius) { //on indique si la distance entre la souris et le centre du cercle est inférieure à son rayon (dans ce cas, la souris est dans le cercle)
    return getDist({
      x: x,
      y: y
    }, circle_pos) <= radius;
  }

  this.init = function() { //initialisation de la position (car apparemment il n'y a pas de constructeurs dans cette version du JavaScript)
    this.anchorPos = {
      x: this.x,
      y: this.y + this.height / 2
    };
  };

  this.isPointInAnchor = function(x, y) {
    return isPointInCircle(x, y, this.anchorPos, this.height);
  };

  //cursor_grabbing et cursor_grab prennent en compte si on est sous Chrome ou pas (qui nécessite un "-webkit-" avant ces 2 curseurs là au moins)
  this.handleMouseEvent = function(e) {
    var in_anchor = this.isPointInAnchor(mouseX, mouseY);

    if (in_anchor && e.type == "mousedown") {
      cursor_locked_by = this;
      GEBID("mycanvas").style.cursor = cursor_grabbing;
      this.onMouseDown(mouseX, mouseY);
    }

    if (e.type == "mouseup") {
      if (cursor_locked_by == this) {
        GEBID("mycanvas").style.cursor = in_anchor ? cursor_grab : "";
        cursor_locked_by = undefined;
      }
      this.onMouseUp(mouseX, mouseY);
    }

    if (e.type == "mousemove") {
      if (!locked && in_anchor) GEBID("mycanvas").style.cursor = cursor_grab;
      this.onMouseMove(mouseX, mouseY);
    }
  };

  var point_down_x, pos_x_down;

  var locked = false;

  this.onMouseDown = function(x, y) {
    point_down_x = x;
    pos_x_down = this.anchorPos.x;
    locked = true;
  };

  this.onMouseUp = function(x, y) {
    locked = false;
  };

  this.onMouseMove = function(x, y) {
    if (!locked) return;

    this.anchorPos.x = constrain(pos_x_down + x - point_down_x, this.x, this.x + this.width); //new_pos_x = pos_x_down + delta   (avec delta = x - point_down_x)
    this.selectedColorHue = ((this.anchorPos.x - this.x) * (359 / this.width)) / 359;
  };

  this.draw = function() {
    //un peu barbare comme façon de faire un arc-en-ciel, mais ne marche pas parfaitement avec la fonction Rainbow() créée plus bas car la couleur sélectionnée ne correspond pas vraiment
    for (var i = 0; i < this.width; i++) {
      Ligne(this.x + i, this.y, this.x + i, this.y + this.height, HSBtoRGB((i * (359 / this.width)) / 359, 1, 1));
    }

    CerclePlein(this.anchorPos.x, this.anchorPos.y, 2 * this.height, rgb(96, 125, 139));
  };
}

function ListView() {
  //liste
  this.width = 800;
  this.height = 600;
  this.spacing = 5; //espacement entre tous les composants du contrôle : items, scrollbar et margin
  this.parentBackgroundColor = "black"; //sert à repeindre le fond du parent (ici le canvas)
  this.list = []; //contient la liste de string à afficher
  this.selectedIndex = 0; //index de l'élément sélectionné
  //items
  this.itemHeight = 50;
  this.itemTextMargin = {
    left: 16,
    top: 32
  };
  this.itemTextSize = 20;

  //scroll
  this.scrollBarWidth = 20; //largeur de la scrollbar
  this.scrollOffset = 0; //quantité de déplacement du contenu vers le haut : à l'initialisation, aucun contenu ne "dépasse" en haut, donc = 0
  this.scrollEnabled = true; //indique si le scroll (défilement) est autorisé ou non. Il ne l'est pas si le nombre d'éléments à afficher ne dépasse pas
  //compare la différence entre la position down et up de la souris et une certaine marge d'erreur. On peut facilement décaler un peu la souris sans faire exprès quand on clique

  function isPointClicked(x_down, y_down, x_up, y_up, error_margin) {
    return (x_up >= x_down - error_margin) && (x_up <= x_down + error_margin) && (y_up >= y_down - error_margin) && (y_up <= y_down + error_margin);
  }

  //calcule la partie de la liste à afficher (la partie visible dans la fenêtre actuelle) : rien ne sert de parcourir toute la liste dans la boucle for
  this.udpdateItemsToDraw = function() {
    var min = getPreviousFullItemIndex(this.scrollOffset, this.itemHeight + this.spacing);
    var max = getPreviousFullItemIndex(this.scrollOffset + this.height - this.spacing, this.itemHeight + this.spacing);

    if (max > this.list.length - 1) {
      max = this.list.length - 1;
    }

    this.itemsToDraw = {
      min: min,
      max: max
    };
  };

  this.updateScrollBarRect = function() {
    this.scrollBarRect = {
      x: this.x + this.width - this.scrollBarWidth,
      y: this.y + this.spacing + this.scrollOffset * this.scrollRatio,
      width: this.scrollBarWidth - this.spacing,
      height: this.scrollBarHeight - 2 * this.spacing
    };
  };

  this.setScrollOffset = function(offset) {
    this.scrollOffset = constrain(offset, 0, this.totalHeight - this.height);

    this.updateScrollBarRect();
    this.udpdateItemsToDraw();
  };

  this.setList = function(list) {
    this.list = list;
    this.totalHeight = list.length * this.itemHeight + (list.length + 1) * this.spacing;
    this.scrollRatio = (this.list.length > 0) ? this.height / this.totalHeight : 1; //la liste peut être vide, dans ce cas, le ratio doit être de 1 pour que la scrollBar fasse la hauteur de la liste entière
    if (this.totalHeight <= this.height - 2 * this.itemHeight) { //autrement dit, si la hauteur totale des éléments ne dépasse pas celle de la liste, on désactive le scroll
      this.scrollEnabled = false;
      this.scrollRatio = 1;
    }

    this.scrollBarHeight = this.height * this.scrollRatio;

    this.updateScrollBarRect();
    this.udpdateItemsToDraw();
  };

  this.isPointInListView = function(x, y) {
    return isPointInRect(x, y, this.x, this.y, this.width, this.height);
  };

  this.isPointInList = function(x, y) {
    return isPointInRect(x, y, this.x + this.spacing, this.y + this.spacing, this.width - 2 * this.spacing - this.scrollBarWidth, this.height - 2 * this.spacing);
  };

  this.isPointInScrollBar = function(x, y) {
    return isPointInRect(x, y, this.scrollBarRect.x, this.scrollBarRect.y, this.scrollBarRect.width, this.scrollBarRect.height);
  };

  this.getIndexByPosition = function(y) {
    var real_y = y - this.y - this.spacing + this.scrollOffset;
    var i = getPreviousFullItemIndex(real_y, this.itemHeight + this.spacing);

    if (y > this.y + this.spacing + (this.spacing + this.itemHeight) * i - this.scrollOffset + this.itemHeight) {
      i = -1; //pas sélectionné car le clic est dans l'espace entre 2 éléments
    }

    return i;
  };

  this.handleMouseEvent = function(e) {
    if (this.isPointInListView(mouseX, mouseY) && e.type == "mousedown") {
      this.onMouseDown(mouseX, mouseY);
    }

    if (e.type == "mouseup") {
      this.onMouseUp(mouseX, mouseY);
    }

    if (!this.scrollEnabled) return;

    if (e.type == "mousemove") {
      this.onMouseMove(mouseX, mouseY);
    }
  };

  var point_down, offset_down;

  var locked_in_list = false;
  var locked_in_scrollbar = false;

  this.onMouseDown = function(x, y) {
    point_down = {
      x: x,
      y: y
    };
    offset_down = this.scrollOffset;

    locked_in_list = this.isPointInList(x, y);
    locked_in_scrollbar = this.isPointInScrollBar(x, y);
  };

  this.error_margin = 3;

  this.onSelectedChanged = function() {};

  this.onMouseUp = function(x, y) {
    if (locked_in_list && isPointClicked(point_down.x, point_down.y, x, y, this.error_margin)) {
      var i = this.getIndexByPosition(y);

      if (i > -1 && i < this.list.length) { //on ne veut pas avoir aucune sélection dans la liste donc si i = -1 on ne fait rien
        this.selectedIndex = i;
        this.onSelectedChanged();
      }
    }

    locked_in_list = false;
    locked_in_scrollbar = false;
  };

  var delta, new_offset;

  this.onMouseMove = function(x, y) {
    if (!(locked_in_list || locked_in_scrollbar)) return;

    delta = y - point_down.y;

    if (locked_in_list) {
      new_offset = offset_down - delta;
    }

    if (locked_in_scrollbar) {
      new_offset = offset_down + delta / this.scrollRatio;
    }

    this.setScrollOffset(new_offset);
  };

  this.draw = function() {
    RectanglePlein(this.x, this.y, this.width, this.height, "lightgrey"); //fond de la liste
    RectanglePlein(this.scrollBarRect.x, this.scrollBarRect.y, this.scrollBarRect.width, this.scrollBarRect.height, "skyblue"); //scrollbar
    if (this.list.length == 0) return; //si la liste est vide, on ne dessine rien d'autre
    setFont("Helvetica", this.itemTextSize);

    //on dessine les éléments à dessiner (ce qu'on a calculé précédemment)
    for (var i = this.itemsToDraw.min; i <= this.itemsToDraw.max; i++) {
      RectanglePlein(this.x + this.spacing, this.y + this.spacing + (this.spacing + this.itemHeight) * i - this.scrollOffset, this.width - 2 * this.spacing - this.scrollBarWidth, this.itemHeight, (i == this.selectedIndex) ? "cornflowerblue" : "aliceblue");
      Texte(this.x + this.spacing + this.itemTextMargin.left, this.y + this.spacing + this.itemTextMargin.top + (this.spacing + this.itemHeight) * i - this.scrollOffset, this.list[i], "black");
    }

    //on peut avoir 1 élément qui dépasse en haut, et 1 élément qui dépasse en bas ; alors on triche et on redessine une bordure et un bout du fond, en haut et en bas
    RectanglePlein(this.x, this.y, this.width, -this.itemHeight, this.parentBackgroundColor);
    RectanglePlein(this.x, this.y, this.width, this.spacing, "lightgrey");
    RectanglePlein(this.x, this.y + this.height, this.width, -this.spacing, "lightgrey");
    RectanglePlein(this.x, this.y + this.height, this.width, this.itemHeight + this.spacing, this.parentBackgroundColor);
  };
}

function Text(text, text_size) {
  this.shouldDraw = true;
  this.color = "white";
  this.text = text;
  var self = this;

  //pour le texte "Appuyez sur espace pour commencer" qui clignote dans le mini-jeu
  this.enableTwinkle = function() {
    addInterval(text, function() {
      self.shouldDraw = !self.shouldDraw;
    }, 500);
  };

  this.setPosition = function(x, y) {
    this.x = x;
    this.y = y;
  };

  this.centerHorizontally = function(y) {
    setFont('Helvetica', text_size);
    this.x = (canvas_width - getTextWidth(text)) / 2;
    this.y = y;
  };

  this.draw = function() {
    if (this.shouldDraw) {
      setFont('Helvetica', text_size);
      Texte(this.x, this.y, this.text, this.color);
    }
  };
}

var btn_state = {
  UP: 0,
  HOVER: 1,
  DOWN: 2
};

function Button(size, colors, text, text_color, text_size) {
  this.text = text;
  this.state = btn_state.UP;

  this.centerHorizontally = function(y) {
    this.x = (canvas_width - size.width) / 2;
    this.y = y;
  };

  this.onClick = function() {};

  this.testAndSetState = function(x, y, state) {
    if (isPointInRect(x, y, this.x, this.y, size.width, size.height)) {
      this.state = state;

      if (this.state == btn_state.UP) {
        this.onClick();
      }
    } else {
      this.state = btn_state.UP;
    }
  };

  this.draw = function() {
    setFont('Helvetica', text_size);
    RectanglePlein(this.x, this.y, size.width, size.height, colors[this.state]);
    Texte(this.x + (size.width - getTextWidth(text)) / 2, this.y + 0.92 * (size.height + text_size) / 2, this.text, text_color);
  };
}

function NumericUpDown(text, colors) {
  this.x = 100;
  this.y = 100;
  this.width = 100;
  this.height = 50;
  this.value = 100;
  this.min = 0;
  this.max = 999;
  this.text = text;

  this.alignRight = function(margin_right, y) {
    this.x = canvas_width - this.width - margin_right;
    this.y = y;

    this.up = {
      //en haut
      x1: this.x + 2 * this.width / 3 + this.width / 6,
      y1: this.y + 5,
      //en bas à gauche
      x2: this.x + 2 * this.width / 3 + 5,
      y2: this.y + this.height / 2 - 4,
      //en bas à droite
      x3: this.x + this.width - 5,
      y3: this.y + this.height / 2 - 4
    };

    this.down = {
      //en bas
      x1: this.x + 2 * this.width / 3 + this.width / 6,
      y1: this.y + this.height - 5,
      //en haut à gauche
      x2: this.x + 2 * this.width / 3 + 5,
      y2: this.y + this.height / 2 + 4,
      //en haut à droite
      x3: this.x + this.width - 5,
      y3: this.y + this.height / 2 + 4
    };
  };

  this.onValueChanged = function(value) {};

  this.setMinMax = function(min, max) {
    this.min = min;
    this.max = max;

    this.value = constrain(this.value, this.min, this.max);
  };

  var up_locked = false,
   down_locked = false;

  this.handleMouseEvent = function(e) {
    if (e.type == "mousedown") {
      this.onMouseDown(mouseX, mouseY);
    }

    if (e.type == "mouseup") {
      this.onMouseUp(mouseX, mouseY);
    }

    if (e.type == "mousemove") {
      this.onMouseMove(mouseX, mouseY);
    }
  };

  this.up_state = btn_state.UP;
  this.down_state = btn_state.UP;

  this.onMouseDown = function(x, y) {
    if (isPointInTriangle(x, y, this.up)) {
      up_locked = true;
      this.increment(1);
      this.up_state = btn_state.DOWN;
    }

    if (isPointInTriangle(x, y, this.down)) {
      down_locked = true;
      this.increment(-1);
      this.down_state = btn_state.DOWN;
    }
  };

  this.onMouseUp = function(x, y) {
    up_locked = false;
    down_locked = false;
    this.up_state = btn_state.UP;
    this.down_state = btn_state.UP;

    //ces variables servent pour le défilement rapide des nombres quand on reste appuyé
    this.i = 0;
    this.i_max = 10;
    this.j = 0;
  };

  this.onMouseMove = function(x, y) {
    if (this.up_state == btn_state.DOWN || this.down_state == btn_state.DOWN) return;

    if (isPointInTriangle(x, y, this.up)) {
      this.up_state = btn_state.HOVER;
    } else {
      this.up_state = btn_state.UP;
    }

    if (isPointInTriangle(x, y, this.down)) {
      this.down_state = btn_state.HOVER;
    } else {
      this.down_state = btn_state.UP;
    }
  };

  this.increment = function(value) {
    this.value = constrain(this.value + value, this.min, this.max);
    this.onValueChanged(this.value);
  };

  this.i = 0;
  this.i_max = 10;
  this.j = 0;

  this.draw = function() {
    setFont("Helvetica", 28);
    Texte(this.x - getTextWidth(this.text) - 20, this.y + 34, this.text, "black");

    RectanglePlein(this.x - 2, this.y - 2, this.width + 4, this.height + 4, rgb(96, 125, 139));
    RectanglePlein(this.x, this.y, 2 * this.width / 3, this.height, "white");
    PolygonePlein(this.up.x1, this.up.y1, this.up.x2, this.up.y2, this.up.x3, this.up.y3, colors[this.up_state]);
    PolygonePlein(this.down.x1, this.down.y1, this.down.x2, this.down.y2, this.down.x3, this.down.y3, colors[this.down_state]);

    /* Pour l'accélération, on utilise une double incrémentation (i et j). On incrémente la valeur si i dépasse un certain nombre. Et ce certain nombre diminue quand j dépasse 5... */

    if (up_locked || down_locked) {
      this.i++;

      if (this.i > this.i_max) {
        if (up_locked) this.increment(1);
        if (down_locked) this.increment(-1);

        this.i = 0;
        this.j++;

        if (this.j > 5) {
          this.i_max -= 5;
          this.j = 0;
        }
      }
    }

    Texte(this.x + (2 * this.width / 3 - getTextWidth(this.value)) / 2, this.y + this.height - 15, this.value, "black");
  };
}


/* --------------------------------- [ STAGE = MENU ] --------------------------------------- */


var menu_buttons = [];
var title_x;

function setupMenu() {
  var size = {
    width: 500,
    height: 150
  };

  setFont('Calibri', 120);
  title_x = (canvas_width - getTextWidth("Duo Breakout")) / 2;

  //Mise en place des boutons
  menu_buttons[0] = new Button(size, red_button_colors, "Jouer", "white", 80);
  menu_buttons[0].centerHorizontally(350);
  menu_buttons[0].onClick = function() {
    if (current_level_filename == "Aucun niveau choisi") {
      current_level_config = createLevelOne();
      current_level_filename = getLevelFileList()[0]; //après avoir créé le niveau 1 (createLevelOne() juste au-dessus), il y aura forcément 1 élément dans cette liste
    }

    //on met le jeu en place et on le lance
    setupGame();
    game.status = game_status.RUNNING;
    game.stage = game_stage.GAME;
  };

  menu_buttons[1] = new Button(size, red_button_colors, "Choix du niveau", "white", 50);
  menu_buttons[1].centerHorizontally(550);
  menu_buttons[1].onClick = function() {
    //on montre la liste des niveaux
    setupLevelList();
    setupLevelListListeners();
    game.stage = game_stage.LEVEL_LIST;
  };

  size = {
    width: 300,
    height: 80
  };

  menu_buttons[2] = new Button(size, green_button_colors, "Instructions", "white", 30);
  menu_buttons[2].x = 50;
  menu_buttons[2].y = canvas_height - size.height - 50;
  menu_buttons[2].onClick = function() {
    //on montre les instructions
    setupInstructionsListeners();
    game.stage = game_stage.INSTRUCTIONS;
  };
}

function setupMenuListeners() {
  onmousedown = function(e) {
    for (var i = 0; i < menu_buttons.length; i++) {
      menu_buttons[i].testAndSetState(mouseX, mouseY, btn_state.DOWN);
    }
  };

  onmouseup = function(e) {
    for (var i = 0; i < menu_buttons.length; i++) {
      menu_buttons[i].testAndSetState(mouseX, mouseY, btn_state.UP);
    }
  };
}

function getAuthors() {
  return "Auteurs :\n\n" + "Chan Pierre-Louis\n" + "Foessel Erwan\n" + "Girard Corentin";
}

function getScoresList() {
  var scores = "";

  for (var i = 0; i < game_config.best_scores.length; i++) {
    scores += (i + 1) + " - " + game_config.best_scores[i] + "\n\n";
  }

  return scores;
}

function drawMenu() {
  Clear("black");

  //titre
  setFont("Calibri", 120);
  Texte(title_x, 200, "Duo Breakout", "white");

  //auteurs
  setFont("Helvetica", 20);
  Texte(canvas_width - 200, canvas_height - 150, getAuthors(), "white");

  //meilleurs scores
  Rectangle(80, 180, 430, 480, "white");

  setFont("Helvetica", 38);
  Texte(130, 250, "Meilleurs scores :", "white");

  setFont("Helvetica", 30);
  Texte(130, 330, getScoresList(), "white");

  //boutons
  for (var i = 0; i < menu_buttons.length; i++) {
    if (menu_buttons[i].state != btn_state.DOWN) {
      menu_buttons[i].testAndSetState(mouseX, mouseY, btn_state.HOVER);
    }

    menu_buttons[i].draw();
  }
}


/* ------------------------------------------- [ STAGE = LEVEL_LIST ] --------------------------------------------- */


function setupLevelListListeners() {
  onmousedown = function(e) {
    lv.handleMouseEvent(e);

    for (var i = 0; i < level_list_buttons.length; i++) {
      level_list_buttons[i].testAndSetState(mouseX, mouseY, btn_state.DOWN);
    }
  };

  onmouseup = function(e) {
    lv.handleMouseEvent(e);

    for (var i = 0; i < level_list_buttons.length; i++) {
      level_list_buttons[i].testAndSetState(mouseX, mouseY, btn_state.UP);
    }
  };

  onmousemove = function(e) {
    updateMousePos(e);

    if (e.target.id == "mycanvas") {
      lv.handleMouseEvent(e);
    }
  };
}

var lv, level_list_buttons = [];

var current_level_filename;

function setupLevelList() {
  lv = new ListView();
  lv.x = 800;
  lv.y = 200;
  lv.setList(getLevelFileList());
  lv.selectedIndex = getCurrentLevelIndex();
  lv.onSelectedChanged = function() {
    //on montre la prévisualtion du niveau tout juste sélectionné
    setupGridPreview();
  };

  //on montre la prévisualtion du niveau sélectionné
  setupGridPreview();

  setupLevelListListeners();

  var size = {
    width: 200,
    height: 80
  };

  var x = lv.x + lv.width + 50;

  level_list_buttons[0] = new Button(size, red_button_colors, "Nouveau", "white", 33);
  level_list_buttons[0].x = x;
  level_list_buttons[0].y = 200;
  level_list_buttons[0].onClick = function() {
    //on crée le niveau par défaut et on montre l'éditeur de niveau
    editor_level_config = getDefaultLevel();
    setupLevelEditor();
    setupLevelEditorListeners();
    game.stage = game_stage.LEVEL_EDITOR;
  };

  level_list_buttons[1] = new Button(size, red_button_colors, "Choisir", "white", 33);
  level_list_buttons[1].x = x;
  level_list_buttons[1].y = 310;
  level_list_buttons[1].onClick = function() {
    //si la liste est vide, on crée le niveau 1 et on le choisit
    if (lv.list.length == 0) {
      current_level_config = createLevelOne();
      lv.setList(getLevelFileList());
      lv.selectedIndex = 0;
      current_level_filename = lv.list[lv.selectedIndex];
      game_config.selectedLevelFilename = current_level_filename;
      saveConfigFile();
      return;
    }

    //si la liste n'était pas vide, on choisit le niveau, et on enregistre cette sélection dans le configFile
    current_level_filename = lv.list[lv.selectedIndex];
    current_level_config = readLevelFile(current_level_filename);
    game_config.selectedLevelFilename = current_level_filename;
    saveConfigFile();
  };

  level_list_buttons[2] = new Button(size, red_button_colors, "Modifier", "white", 33);
  level_list_buttons[2].x = x;
  level_list_buttons[2].y = 420;
  level_list_buttons[2].onClick = function() {
    //on charge le niveau sélectionné et on ouvre l'éditeur de niveau
    editor_level_config = readLevelFile(lv.list[lv.selectedIndex]);
    setupLevelEditor();
    setupLevelEditorListeners();
    game.stage = game_stage.LEVEL_EDITOR;
  };

  level_list_buttons[3] = new Button(size, red_button_colors, "Supprimer", "white", 33);
  level_list_buttons[3].x = x;
  level_list_buttons[3].y = 530;
  level_list_buttons[3].onClick = function() {
    //on supprime le fichier, et on met la liste à jour
    removeFile(lv.list[lv.selectedIndex]);
    lv.setList(getLevelFileList());

    if (lv.list.length == 0) {
      current_level_filename = "Aucun niveau choisi";
      return;
    }

    //si l'index sélectionné est en dehors de la nouvelle liste, on le met à la fin
    if (lv.selectedIndex > lv.list.length - 1) {
      lv.selectedIndex = lv.list.length - 1;
    } else { //sinon on récupère le nouvel index de l'ancien niveau sélectionné
      lv.selectedIndex = getCurrentLevelIndex();
    }

    current_level_filename = lv.list[lv.selectedIndex];
    current_level_config = readLevelFile(current_level_filename);
    game_config.selectedLevelFilename = current_level_filename;
    saveConfigFile();

    setupGridPreview();
  };

  level_list_buttons[4] = new Button(size, red_button_colors, "Retour", "white", 33);
  level_list_buttons[4].x = 50;
  level_list_buttons[4].y = canvas_height - 130;
  level_list_buttons[4].onClick = function() {
    //on retourne au menu
    resetButtonListeners();
    setupMenuListeners();
    game.stage = game_stage.MENU;
  };
}

var preview_x, preview_y, preview_width, preview_level_config, preview_space_between_bricks, preview_ratio;
var x, y, width, height;

function setupGridPreview() {
  preview_x = 100;
  preview_y = 320;
  preview_width = 600;

  preview_level_config = readLevelFile(lv.list[lv.selectedIndex]);

  preview_ratio = preview_width / canvas_width;

  preview_space_between_bricks = {
    x: space_between_bricks.x * preview_ratio,
    y: space_between_bricks.y * preview_ratio
  };

  width = (canvas_width - (preview_level_config.max_brick_count.x - 1) * space_between_bricks.x - preview_level_config.brick_area_margin.left - preview_level_config.brick_area_margin.right) / preview_level_config.max_brick_count.x;
  width *= preview_ratio;
  height = (canvas_height - (preview_level_config.max_brick_count.y - 1) * space_between_bricks.y - preview_level_config.brick_area_margin.top - preview_level_config.brick_area_margin.bottom) / preview_level_config.max_brick_count.y;
  height *= preview_ratio;
}

//montre une prévisualisation du niveau sélectionné dans la liste

function drawGridPreview() {
  RectanglePlein(preview_x, preview_y, preview_width, preview_ratio * canvas_height, "white");

  for (var j = 0; j < preview_level_config.max_brick_count.y; j++) {
    for (var i = 0; i < preview_level_config.max_brick_count.x; i++) {
      x = preview_x + preview_level_config.brick_area_margin.left * preview_ratio + i * (width + preview_space_between_bricks.x);
      y = preview_y + preview_level_config.brick_area_margin.top * preview_ratio + j * (height + preview_space_between_bricks.y);

      if (preview_level_config.bricks[j][i].state < 0) {
        RectanglePlein(x, y, width, height, "black");
      } else if (preview_level_config.bricks[j][i].state > 0) {
        RectanglePlein(x, y, width, height, HSBtoRGB(preview_level_config.bricks[j][i].color_hue / 360, 1, brick_brightness[preview_level_config.bricks[j][i].state]));
      }
    }
  }
}

function drawLevelList() {
  Clear("black");

  lv.draw();
  drawGridPreview();

  setFont("Helvetica", 50);
  Texte(80, 100, "Liste des niveaux", "white");

  setFont("Helvetica", 20);
  Texte(lv.x, lv.y + lv.height + 40, "Niveau actuel : " + current_level_filename + " (" + (lv.selectedIndex + 1) + "/" + lv.list.length + ")", "white");

  for (var i = 0; i < level_list_buttons.length; i++) {
    if (level_list_buttons[i].state != btn_state.DOWN) {
      level_list_buttons[i].testAndSetState(mouseX, mouseY, btn_state.HOVER);
    }

    level_list_buttons[i].draw();
  }
}


/* ------------------------------------- [ STAGE = LEVEL EDITOR ] --------------------------------------- */


var cp;
var level_editor_buttons = [];
var level_editor_anchors = [];
var level_editor_numericsUD = [];

var editor_level_config; //la configuration de niveau en cours d'édition
var editor_brick_rect;

function setupLevelEditorListeners() {
  onmousedown = function(e) {
    cp.handleMouseEvent(e);

    for (var i = 0; i < level_editor_buttons.length; i++) {
      level_editor_buttons[i].testAndSetState(mouseX, mouseY, btn_state.DOWN);
    }

    for (i = 0; i < level_editor_anchors.length; i++) {
      level_editor_anchors[i].handleMouseEvent(e);
      level_editor_numericsUD[i].handleMouseEvent(e);
    }
  };

  onmouseup = function(e) {
    cp.handleMouseEvent(e);

    for (var i = 0; i < level_editor_buttons.length; i++) {
      level_editor_buttons[i].testAndSetState(mouseX, mouseY, btn_state.UP);
    }

    for (i = 0; i < level_editor_anchors.length; i++) {
      level_editor_anchors[i].handleMouseEvent(e);
      level_editor_numericsUD[i].handleMouseEvent(e);
    }

    if (!cursor_locked_by && isPointInRect(mouseX, mouseY, editor_brick_rect.x, editor_brick_rect.y, editor_brick_rect.width, editor_brick_rect.height)) {
      handleClickOnEditorBrick(e);
    }

    //le fait de faire ça ici et pas dans le handleMouseEvent d'Anchor ou de ColorPicker (les 2 qui utilisent 'cursor_locked_by') évite qu'une brique
    //soit cliquée quand on lâche le clic alors qu'on déplaçait une Anchor... (cf. test dans le if précédent)
    cursor_locked_by = undefined;
  };

  onmousemove = function(e) {
    updateMousePos(e);

    if (!cursor_locked_by) {
      GEBID("mycanvas").style.cursor = "";
    }

    if (e.target.id == "mycanvas") {
      cp.handleMouseEvent(e);
    }

    for (var i = 0; i < level_editor_anchors.length; i++) {
      level_editor_anchors[i].handleMouseEvent(e);
      level_editor_numericsUD[i].handleMouseEvent(e);
    }
  };
}

function handleClickOnEditorBrick(e) {
  var i = getPreviousFullItemIndex(mouseX - editor_brick_rect.x, width + space_between_bricks.x);
  if (mouseX > editor_level_config.brick_area_margin.left + i * (width + space_between_bricks.x) + width) return; //clic sur un espace x entre les briques
  var j = getPreviousFullItemIndex(mouseY - editor_brick_rect.y, height + space_between_bricks.y);
  if (mouseY > editor_level_config.brick_area_margin.top + j * (height + space_between_bricks.y) + height) return; //clic sur un espace y entre les briques
  if (e.button == 0 && editor_level_config.bricks[j][i].state < 5) { //clic gauche, max de vies = 5
    if (editor_level_config.bricks[j][i].state == 0) { //si la brique est invisible, on en profite pour attribuer sa couleur : alternative au clic molette pour les pavés tactiles
      editor_level_config.bricks[j][i].color_hue = Math.round(cp.selectedColorHue * 360);
    }

    editor_level_config.bricks[j][i].state++;
  }

  if (e.button == 1) { //clic molette
    editor_level_config.bricks[j][i].color_hue = Math.round(cp.selectedColorHue * 360);
  }

  if (e.button == 2 && editor_level_config.bricks[j][i].state > -1) { //clic droit, min de vies = -1 qui correspond à une brique incassable
    editor_level_config.bricks[j][i].state--;
  }
}

function setAnchorsPosition() {
  level_editor_anchors[0].x = editor_brick_rect.x + (editor_brick_rect.width - level_editor_anchors[0].width) / 2; //haut
  level_editor_anchors[0].y = editor_level_config.brick_area_margin.top - 50;

  level_editor_anchors[1].x = level_editor_anchors[0].x; //bas
  level_editor_anchors[1].y = canvas_height - editor_level_config.brick_area_margin.bottom + 50 - level_editor_anchors[1].height;

  level_editor_anchors[2].x = editor_level_config.brick_area_margin.left - 50; //gauche
  level_editor_anchors[2].y = editor_brick_rect.y + (editor_brick_rect.height - level_editor_anchors[2].height) / 2;

  level_editor_anchors[3].x = canvas_width - editor_level_config.brick_area_margin.right + 50 - level_editor_anchors[3].width; //droite
  level_editor_anchors[3].y = level_editor_anchors[2].y;
}

function setupLevelEditor() {
  demo_ball_y = demo_ball_min_y;

  /* Le ColorPicker pour choisir la couleur des briques */
  cp = new ColorPicker();
  cp.x = canvas_width - cp.width - 80;
  cp.y = 80;
  cp.init();

  /* Les NumericUpDown pour les valeurs numériques */
  level_editor_numericsUD[0] = new NumericUpDown("Briques par ligne", red_button_colors);
  level_editor_numericsUD[0].alignRight(50, 180);
  level_editor_numericsUD[0].setMinMax(1, 20);
  level_editor_numericsUD[0].value = editor_level_config.max_brick_count.x;

  level_editor_numericsUD[1] = new NumericUpDown("Briques par colonne", red_button_colors);
  level_editor_numericsUD[1].alignRight(50, 280);
  level_editor_numericsUD[1].setMinMax(1, 20);
  level_editor_numericsUD[1].value = editor_level_config.max_brick_count.y;

  level_editor_numericsUD[2] = new NumericUpDown("Vitesse balle", red_button_colors);
  level_editor_numericsUD[2].alignRight(50, 500);
  level_editor_numericsUD[2].setMinMax(5, 15);
  level_editor_numericsUD[2].value = editor_level_config.ball_speed;
  level_editor_numericsUD[2].onValueChanged = function(value) {
    editor_level_config.ball_speed = value;
  };

  level_editor_numericsUD[3] = new NumericUpDown("Longueur raquette", red_button_colors);
  level_editor_numericsUD[3].alignRight(50, 600);
  level_editor_numericsUD[3].setMinMax(20, 200);
  level_editor_numericsUD[3].value = editor_level_config.racket_length;
  level_editor_numericsUD[3].onValueChanged = function(value) {
    editor_level_config.racket_length = value;
  };

  editor_brick_rect = {
    x: editor_level_config.brick_area_margin.left,
    y: editor_level_config.brick_area_margin.top,
    width: canvas_width - editor_level_config.brick_area_margin.left - editor_level_config.brick_area_margin.right,
    height: canvas_height - editor_level_config.brick_area_margin.top - editor_level_config.brick_area_margin.bottom
  };

  /* Les poignées pour redimensionner la grille des briques */
  level_editor_anchors[0] = new Anchor(direction.VERTICAL); //en haut
  level_editor_anchors[0].y = editor_level_config.brick_area_margin.top - 50;
  level_editor_anchors[0].setMinMax(level_editor_anchors[0].y, canvas_height / 2 - 150);

  level_editor_anchors[0].onValueChanged = function(y) {
    editor_level_config.brick_area_margin.top = y + 50;
    editor_brick_rect.y = editor_level_config.brick_area_margin.top;
    editor_brick_rect.height = canvas_height - editor_level_config.brick_area_margin.top - editor_level_config.brick_area_margin.bottom;

    level_editor_anchors[2].y = editor_brick_rect.y + (editor_brick_rect.height - level_editor_anchors[2].height) / 2;
    level_editor_anchors[3].y = editor_brick_rect.y + (editor_brick_rect.height - level_editor_anchors[3].height) / 2;
  };

  level_editor_anchors[1] = new Anchor(direction.VERTICAL); //en bas
  level_editor_anchors[1].y = canvas_height - editor_level_config.brick_area_margin.bottom + 50 - level_editor_anchors[1].height;
  level_editor_anchors[1].setMinMax(canvas_height / 2 + 150, level_editor_anchors[1].y);

  level_editor_anchors[1].onValueChanged = function(y) {
    editor_level_config.brick_area_margin.bottom = canvas_height - y + 50 - level_editor_anchors[1].height;
    editor_brick_rect.height = canvas_height - editor_level_config.brick_area_margin.top - editor_level_config.brick_area_margin.bottom;

    level_editor_anchors[2].y = editor_brick_rect.y + (editor_brick_rect.height - level_editor_anchors[2].height) / 2;
    level_editor_anchors[3].y = editor_brick_rect.y + (editor_brick_rect.height - level_editor_anchors[3].height) / 2;
  };

  level_editor_anchors[2] = new Anchor(direction.HORIZONTAL); //à gauche
  level_editor_anchors[2].x = editor_level_config.brick_area_margin.left - 50;
  level_editor_anchors[2].setMinMax(450 - level_editor_anchors[2].width / 2, canvas_width / 2 - 300 - level_editor_anchors[2].width / 2);

  level_editor_anchors[2].onValueChanged = function(x) {
    editor_level_config.brick_area_margin.left = x + 50;
    editor_brick_rect.x = editor_level_config.brick_area_margin.left;
    editor_brick_rect.width = canvas_width - editor_level_config.brick_area_margin.left - editor_level_config.brick_area_margin.right;

    level_editor_anchors[0].x = editor_brick_rect.x + (editor_brick_rect.width - level_editor_anchors[0].width) / 2;
    level_editor_anchors[1].x = editor_brick_rect.x + (editor_brick_rect.width - level_editor_anchors[1].width) / 2;
  };

  level_editor_anchors[3] = new Anchor(direction.HORIZONTAL); //à droite
  level_editor_anchors[3].x = canvas_width - editor_level_config.brick_area_margin.right + 50 - level_editor_anchors[3].width;
  level_editor_anchors[3].setMinMax(canvas_width / 2 + 300 - level_editor_anchors[3].width / 2, canvas_width - 450 - level_editor_anchors[3].width / 2);

  level_editor_anchors[3].onValueChanged = function(x) {
    editor_level_config.brick_area_margin.right = canvas_width - x + 50 - level_editor_anchors[3].width;
    editor_brick_rect.width = canvas_width - editor_level_config.brick_area_margin.left - editor_level_config.brick_area_margin.right;

    level_editor_anchors[0].x = editor_brick_rect.x + (editor_brick_rect.width - level_editor_anchors[0].width) / 2;
    level_editor_anchors[1].x = editor_brick_rect.x + (editor_brick_rect.width - level_editor_anchors[1].width) / 2;
  };

  /* Les boutons */
  var size = {
    width: 130,
    height: 50
  };

  level_editor_buttons[0] = new Button(size, red_button_colors, "Centrer x", "white", 20);
  level_editor_buttons[0].x = canvas_width - 420;
  level_editor_buttons[0].y = canvas_height - 180;
  level_editor_buttons[0].onClick = function() {
    //on centre la grille des briques horizontalement
    var delta = (canvas_width - editor_brick_rect.width) / 2 - editor_brick_rect.x;

    editor_brick_rect.x += delta;
    editor_level_config.brick_area_margin.left += delta;
    editor_level_config.brick_area_margin.right -= delta;

    //on remet les anchors à leur place
    setAnchorsPosition();
  };

  level_editor_buttons[1] = new Button(size, red_button_colors, "Centrer y", "white", 20);
  level_editor_buttons[1].x = canvas_width - 420;
  level_editor_buttons[1].y = canvas_height - 120;
  level_editor_buttons[1].onClick = function() {
    //on centre la grille des briques verticalement
    var delta = (canvas_height - editor_brick_rect.height) / 2 - editor_brick_rect.y;

    editor_brick_rect.y += delta;
    editor_level_config.brick_area_margin.top += delta;
    editor_level_config.brick_area_margin.bottom -= delta;

    //on remet les anchors à leur place
    setAnchorsPosition();
  };

  size = {
    width: 200,
    height: 60
  };

  level_editor_buttons[2] = new Button(size, red_button_colors, "Retour", "white", 25);
  level_editor_buttons[2].x = 50;
  level_editor_buttons[2].y = canvas_height - 110;
  level_editor_buttons[2].onClick = function() {
    setupLevelList();
    setupLevelListListeners();
    game.stage = game_stage.LEVEL_LIST;
  };

  level_editor_buttons[3] = new Button(size, red_button_colors, "Valider", "white", 25);
  level_editor_buttons[3].x = canvas_width - 250;
  level_editor_buttons[3].y = 380;
  level_editor_buttons[3].onClick = function() {
    editor_level_config.max_brick_count.x = level_editor_numericsUD[0].value;
    editor_level_config.max_brick_count.y = level_editor_numericsUD[1].value;
    editor_level_config.bricks = getBricksArray(level_editor_numericsUD[0].value, level_editor_numericsUD[1].value);
  };

  level_editor_buttons[4] = new Button(size, red_button_colors, "Reset", "white", 25);
  level_editor_buttons[4].x = canvas_width - 250;
  level_editor_buttons[4].y = canvas_height - 200;
  level_editor_buttons[4].onClick = function() {
    editor_level_config = getDefaultLevel();
    editor_level_config.max_brick_count.x = level_editor_numericsUD[0].value;
    editor_level_config.max_brick_count.y = level_editor_numericsUD[1].value;
    editor_level_config.bricks = getBricksArray(level_editor_numericsUD[0].value, level_editor_numericsUD[1].value);

    editor_brick_rect = {
      x: editor_level_config.brick_area_margin.left,
      y: editor_level_config.brick_area_margin.top,
      width: canvas_width - editor_level_config.brick_area_margin.left - editor_level_config.brick_area_margin.right,
      height: canvas_height - editor_level_config.brick_area_margin.top - editor_level_config.brick_area_margin.bottom
    };

    //on remet les anchors à leur place initiale
    setAnchorsPosition();
  };

  level_editor_buttons[5] = new Button(size, red_button_colors, "Enregistrer", "white", 25);
  level_editor_buttons[5].x = canvas_width - 250;
  level_editor_buttons[5].y = canvas_height - 110;
  level_editor_buttons[5].onClick = function() {
    var result = Saisie("Entrez le numéro du niveau"); //on conseille grandement l'utilisateur d'utiliser un numéro pour l'ordre des niveaux mais on ne l'oblige pas avec une regex
    if (result == null) {
      return;
    }

/*La regex /^\s*$/ correspond à une chaîne qui commence et finit par 0 ou plus espaces quelconques (tabs, etc.). C'est ce que l'on ne veut pas
    Et si la chaîne contient un point (donc potentiellement une extension) mais pas de ".level", ce n'est pas ce que l'on veut non plus.*/
    if (/^\s*$/.test(result) || (result.indexOf(".") != -1 && result.substring(result.indexOf(".")) != ".level")) {
      alert("Le nom de fichier n'est pas au bon format. Entrez juste un numéro !");
      return;
    }

    //si l'utilisateur n'a pas mis d'extension (ce qu'on lui a demandé), on la rajoute
    if (result.indexOf(".") == -1) {
      result = result.trim() + ".level";
    }

    saveLevelFile(result, editor_level_config);

    current_level_filename = result; //on choisit dans la liste l'élément que l'utilisateur vient de créer, et on retourne à la liste des niveaux
    setupLevelList();
    setupLevelListListeners();
    game.stage = game_stage.LEVEL_LIST;
  };

  setupLevelEditorListeners();
}

var x, y, width, height;

function drawEditorGrid() {
  width = (canvas_width - (editor_level_config.max_brick_count.x - 1) * space_between_bricks.x - editor_level_config.brick_area_margin.left - editor_level_config.brick_area_margin.right) / editor_level_config.max_brick_count.x;
  height = (canvas_height - (editor_level_config.max_brick_count.y - 1) * space_between_bricks.y - editor_level_config.brick_area_margin.top - editor_level_config.brick_area_margin.bottom) / editor_level_config.max_brick_count.y;

  for (var j = 0; j < editor_level_config.max_brick_count.y; j++) {
    for (var i = 0; i < editor_level_config.max_brick_count.x; i++) {
      x = editor_level_config.brick_area_margin.left + i * (width + space_between_bricks.x);
      y = editor_level_config.brick_area_margin.top + j * (height + space_between_bricks.y);

      if (editor_level_config.bricks[j][i].state < 0) {
        RectanglePlein(x, y, width, height, "black");
      } else if (editor_level_config.bricks[j][i].state > 0) {
        RectanglePlein(x, y, width, height, HSBtoRGB(editor_level_config.bricks[j][i].color_hue / 360, 1, brick_brightness[editor_level_config.bricks[j][i].state]));
      }
    }
  }
}

/* Montre une démonstration de la vitesse de la balle et la longueur de la raquette */

var demo_ball_y, demo_ball_dir = 1,
 demo_ball_min_y = 400,
 demo_ball_max_y = 720;

function drawBallAndRacket() {
  Texte(60, 370, "Démo :", "black");

  DrawImageObject(img_ball, 230, demo_ball_y - 30, 60, 60);

  RectanglePlein(80, 420 + (300 - editor_level_config.racket_length) / 2, 20, editor_level_config.racket_length, "blue");

  demo_ball_y += demo_ball_dir * editor_level_config.ball_speed;

  if (demo_ball_y > demo_ball_max_y) {
    demo_ball_dir = -1;
  }

  if (demo_ball_y < demo_ball_min_y) {
    demo_ball_dir = 1;
  }
}

function drawLevelEditor() {
  Clear("white");

  setFont("Helvetica", 50);
  Texte(40, 80, "Éditeur de niveau", "black");

  setFont("Helvetica", 24);
  Texte(60, 170, "Commandes pour les briques :\n\n - Clic gauche = ajouter vie\n - Clic molette = appliquer couleur\n - Clic droit = baisser vie\n    (jusqu'à inexistante ou incassable)", "black");

  cp.draw();

  RectanglePlein(cp.x - 120, cp.y - 15, 50, 50, HSBtoRGB(cp.selectedColorHue, 1, 1));
  Rectangle(cp.x - 120, cp.y - 15, 50, 50, "white");
  Rectangle(cp.x - 121, cp.y - 16, 52, 52, "white");

  drawEditorGrid();
  drawBallAndRacket();

  for (var i = 0; i < level_editor_buttons.length; i++) {
    if (level_editor_buttons[i].state != btn_state.DOWN) {
      level_editor_buttons[i].testAndSetState(mouseX, mouseY, btn_state.HOVER);
    }

    level_editor_buttons[i].draw();
  }

  for (i = 0; i < level_editor_anchors.length; i++) {
    level_editor_anchors[i].draw();
    level_editor_numericsUD[i].draw();
  }
}


/* ------------------------------------------ [ STAGE = INSTRUCTIONS ] --------------------------------------------- */


var instruc, instruc_x, line_width, max_line_width = 0,
 instruc_size = 25;

var instruc_btn;

function addInstrucLine(line) {
  instruc += line;

  line_width = getTextWidth(line);
  if (line_width > max_line_width) max_line_width = line_width;
}

function setInstruc() {
  addInstrucLine("Le Joueur 1 contrôle la raquette à gauche de l'écran, avec les touches Z (monter) et S (descendre).\n\n");
  addInstrucLine("Le Joueur 2 contrôle la raquette à droite de l'écran, avec les touches O (monter) et L (descendre).\n\n");
  addInstrucLine("Vous remarquerez qu'une des briques est \"spéciale\" : une fois touchée, cette brique va s'ouvrir et dévoiler un mini-jeu.\n\n");
  addInstrucLine("Dans ce mini-jeu, le Joueur 1 contrôle un vaisseau spatial avec les touches Z (avancer), Q (pivoter à gauche), D (pivoter à droite) et ESPACE (tirer).\n\n");
  addInstrucLine("Le Joueur 2 contrôle un personnage avec les touches O (haut), K (gauche), L (bas) et M (droite).\n\n");
  addInstrucLine("Ce personnage est enfermé dans un cercle dont les déplacements sont aléatoires.\n\n");
  addInstrucLine("Le Joueur 1 (vaisseau) doit sauver le Joueur 2 (enfermé) en tirant sur le cercle.\n\n");
  addInstrucLine("Quand le cercle est vaincu, la brique est détruite et se referme, et le jeu revient à la normale.\n\n");
  addInstrucLine("Si vous perdez dans le mini-jeu, la brique se referme mais n'est pas détuite.\n\n");
  addInstrucLine("Il est impératif de casser toutes les briques pour gagner, donc de gagner le mini-jeu.");
}

function setupInstructions() {
  instruc = "";

  setFont("PT Sans", instruc_size);
  setInstruc();

  instruc_x = (canvas_width - max_line_width) / 2;

  var size = {
    width: 300,
    height: 80
  };

  instruc_btn = new Button(size, green_button_colors, "OK", "white", 30);
  instruc_btn.centerHorizontally(canvas_height - size.height - 60);
  instruc_btn.onClick = function() {
    setupMenuListeners();
    game.stage = game_stage.MENU;
  };
}

function setupInstructionsListeners() {
  onmousedown = function(e) {
    instruc_btn.testAndSetState(mouseX, mouseY, btn_state.DOWN);
  };

  onmouseup = function(e) {
    instruc_btn.testAndSetState(mouseX, mouseY, btn_state.UP);
  };
}

function drawInstructions() {
  Clear("black");

  setFont("Helvetica", 40);
  Texte(instruc_x, 100, "Instructions :", "white");

  setFont("Helvetica", instruc_size);
  Texte(instruc_x, 180, instruc, "white");

  if (instruc_btn.state != btn_state.DOWN) {
    instruc_btn.testAndSetState(mouseX, mouseY, btn_state.HOVER);
  }

  instruc_btn.draw();
}


/* ------------------------------------------ [ STAGE = GAME ] --------------------------------------------- */


var current_level_config; //contient la configuration du niveau choisi
var alive_bricks_count; //le nombre de briques en vie
var run_game; //indique si le jeu doit tourner (faux au début, pour laisser le délai de démarrage du jeu)
var background_color;

function delayGameStart() {
  run_game = false;

  setTimeout(function() {
    run_game = true;
  }, 1000);
}

function setupGame() {
  resetButtonListeners();

  cheat = false;
  background_color = "white";

  alive_bricks_count = 0;

  powerup1 = undefined;
  powerup2 = undefined;

  score = 0;
  lifes = 3;

  added_score_text = new Text("", 30);
  added_score_text.setPosition(150, 100);
  added_score_text.color = "red";

  if (debug_in_brick > -1) { //on peut forcer une brique à être la spéciale pour nous simplifier la vie (seulement pour les dév)
    InitBricks(debug_in_brick);
  } else {
    InitBricks(Random(0, current_level_config.max_brick_count.x * current_level_config.max_brick_count.y - 1));
  }

  InitRackets();
  InitBalls();

  delayGameStart();
}


/* ---------------- [ STAGE = GAME  &&  STATUS = RUNNING ] -------------- */


var score, lifes;

//montre le jeu sans mouvements, juste celui de la raquette

function drawOnlyGameState() {
  Clear("white");

  drawScore();
  drawLifes();

  HandleGameKeyboard();

  for (var y = 0; y < current_level_config.max_brick_count.y; y++) {
    for (var x = 0; x < current_level_config.max_brick_count.x; x++) {
      bricks[y][x].draw();
    }
  }

  racket1.draw();
  racket2.draw();

  ball1.draw();
  ball2.draw();
}

var added_score_text;
var scoreTimeoutId; //contient une référence au dernier timeout du score, pour pouvoir l'effacer

function addToScore(i) {
  if (added_score_text.text != "") {
    i += enEntier(added_score_text.text.substring(2));
  }
  added_score_text.text = "+ " + i;

  clearTimeout(scoreTimeoutId);

  scoreTimeoutId = setTimeout(function() {
    score += enEntier(added_score_text.text.substring(2));
    added_score_text.text = "";
  }, 1000);
}

function drawScore() {
  setFont("Helvetica", 40);
  Texte(30, 60, "Score : " + score, "black");

  added_score_text.draw();
}

function drawLifes() {
  for (var i = 1; i <= lifes; i++) {
    drawHeart(canvas_width - 320 + i * 80, 75);
  }
}

var powerup1, powerup2; //peuvent être un bonus (carré vert) ou un malus (carré rouge)

function handlePowerups() {
  //ceci donne grandement envie d'utiliser des passages de variables par référence à une fonction (avec powerup1 et 2), mais c'est impossible en JavaScript...
  if (Random(0, 1000) == 10) {
    if (Random(0, 1)) { //le 0 ou 1 est compris comme vrai ou faux
      powerup1 = {
        x: racket_margin + racket1.width / 2,
        y: Random(0, 1) ? Random(100, racket1.y - 100) : Random(racket1.y + racket1.height + 100, canvas_height - 100),
        //on le fait spawn au-dessus ou en-dessous de la raquette
        good: Random(0, 1) == 1
      };

      setTimeout(function() {
        powerup1 = undefined;
      }, 2000);
    } else {
      powerup2 = {
        x: canvas_width - racket_margin - racket2.width / 2,
        y: Random(0, 1) ? Random(100, racket2.y - 100) : Random(racket2.y + racket2.height + 100, canvas_height - 100),
        good: Random(0, 1) == 1
      };

      setTimeout(function() {
        powerup2 = undefined;
      }, 2000);
    }
  }

  if (powerup1) {
    RectanglePlein(powerup1.x - 6, powerup1.y - 6, 12, 12, powerup1.good ? "green" : "red");
  }

  if (powerup2) {
    RectanglePlein(powerup2.x - 6, powerup2.y - 6, 12, 12, powerup2.good ? "green" : "red");
  }
}

function Step() {
  HandleGameKeyboard();

  ball1.move();
  ball2.move();

  RacketHitTest();
}

function drawGame() {
  if (!run_game) {
    drawOnlyGameState();
    return;
  }

  Clear(background_color);

  if (alive_bricks_count == 0) {
    loser_player = 0;
    setupGameOver();
    game.status = game_status.OVER;
  }

  drawScore();
  drawLifes();

  handlePowerups();

  Step();

  for (var y = 0; y < current_level_config.max_brick_count.y; y++) {
    for (var x = 0; x < current_level_config.max_brick_count.x; x++) {
      var b = bricks[y][x];

      BrickHitTest(b, ball1);
      BrickHitTest(b, ball2);

      b.draw();
    }
  }

  racket1.draw();
  racket2.draw();

  ball1.draw();
  ball2.draw();
}


/* --------------------------- Gestion des briques --------------------------*/


var space_between_bricks = {
  x: 15,
  y: 15
};

function Rainbow(x, y, width, height) { //création d'un gradient arc-en-ciel approximatif
  var g = ctx.createLinearGradient(ViewX(x), ViewY(y), ViewX(x + width), ViewY(y + height));
  g.addColorStop(0, "red");
  g.addColorStop(1 / 6, "orange");
  g.addColorStop(2 / 6, "yellow");
  g.addColorStop(3 / 6, "lime");
  g.addColorStop(4 / 6, "cyan");
  g.addColorStop(5 / 6, "blue");
  g.addColorStop(1, "violet");
  return g;
}

var brick_brightness = [undefined, 1, 0.85, 0.7, 0.55, 0.4]; //on ne se servira jamais de la case d'index = 0 car elle correspond au state = 0, qui n'est JAMAIS dessiné

function Brick(pos_x, pos_y) { //x et y sont en base zéro
  this.pos_x = pos_x; //position x dans la grille (pas en pixels)
  this.pos_y = pos_y; //pareil avec y
  this.special = false;

  this.updateBrickColor = function() {
    this.color = HSBtoRGB(this.color_hue / 360, 1, brick_brightness[this.state]);
  };

  this.init = function(state, color_hue) {
    //Équation d'origine : canvas_width = max_brick_count.x * width + (max_brick_count.x - 1) * space_between_bricks.x + brick_area_margin.left + brick_area_margin.right
    this.width = (canvas_width - (current_level_config.max_brick_count.x - 1) * space_between_bricks.x - current_level_config.brick_area_margin.left - current_level_config.brick_area_margin.right) / current_level_config.max_brick_count.x;

    //Équation d'origine : canvas_height = max_brick_count.y * height + (max_brick_count.y - 1) * space_between_bricks.y + brick_area_margin.top + brick_area_margin.bottom
    this.height = (canvas_height - (current_level_config.max_brick_count.y - 1) * space_between_bricks.y - current_level_config.brick_area_margin.top - current_level_config.brick_area_margin.bottom) / current_level_config.max_brick_count.y;

    this.x = current_level_config.brick_area_margin.left + this.pos_x * (this.width + space_between_bricks.x);
    this.y = current_level_config.brick_area_margin.top + this.pos_y * (this.height + space_between_bricks.y);

    this.state = state; //valeur comprise entre 0 et 5
    this.color_hue = color_hue;

    this.updateBrickColor();
  };

  this.hit = function() {
    if (cheat) { //si le code konami est activé, la balle détruit la brique instantanément
      this.state = 0;
      alive_bricks_count--;
      addToScore(10);
      return;
    }

    if (this.special) { //si la brique est spéciale, on lance le mini-jeu (stage = in_brick)
      if (in_brick_stage == 0) return; //empêche un bug si la brique spéciale est touchée 2 fois en même temps
      special_brick = this;
      setupInBrick();
      game.stage = game_stage.IN_BRICK;
    } else if (this.state > -1) { //si la brique n'est pas incassable, on lui enlève une vie, et on comptabilise le point
      this.state--;
      this.updateBrickColor();

      if (this.state == 0) {
        alive_bricks_count--;
      }

      addToScore(10);
    }
  };

  this.draw = function() {
    //3 façons de dessiner la brique : en arc-en-ciel si spéciale, de sa couleur si normale et en noir si incassable.
    if (this.state > 0) {
      if (this.special) {
        RectanglePlein(this.x, this.y, this.width, this.height, Rainbow(this.x, this.y, this.width, this.height));
      } else {
        RectanglePlein(this.x, this.y, this.width, this.height, this.color);
      }
    } else if (this.state < 0) {
      RectanglePlein(this.x, this.y, this.width, this.height, "black");
    }
  };
}

var bricks;

function InitBricks(special_brick_position) {
  //On crée un tableau de tableau de briques (un tableau à 2 dimensions)
  bricks = [];

  for (var i = 0; i < current_level_config.max_brick_count.y; i++) {
    bricks[i] = [];
  }

  var postpone_special = false;

  //On initialise le tableau
  for (var y = 0; y < current_level_config.max_brick_count.y; y++) {
    for (var x = 0; x < current_level_config.max_brick_count.x; x++) {
      var b = new Brick(x, y);

      if (y * current_level_config.max_brick_count.x + x == special_brick_position) { //cette brique est spéciale
        if (current_level_config.bricks[y][x].state < 1) { //si cette brique est une brique incassable, on repousse la brique spéciale à la prochaine et ainsi de suite
          postpone_special = true;
        } else {
          b.special = true;
        }
      }

      if (postpone_special && current_level_config.bricks[y][x].state > 0) {
        b.special = true;
        postpone_special = false;
      }

      b.init(current_level_config.bricks[y][x].state, current_level_config.bricks[y][x].color_hue);
      if (b.state != 0) alive_bricks_count++;

      bricks[y][x] = b;
    }
  }
}


/* ------------------------- Gestion des raquettes --------------------------- */


var racket1, racket2;
var racket_margin = 20;

function Racket() {
  this.x = 0;
  this.y = 0;

  this.speed = 10;

  this.width = 20;
  this.height = 100;

  this.setHeight = function(height) {
    this.y = this.y + this.height / 2 - height / 2;
    this.height = height;
  };

  this.setLeft = function() {
    this.x = racket_margin;
    this.y = (canvas_height - this.height) / 2;
  };

  this.setRight = function() {
    this.x = canvas_width - this.width - racket_margin;
    this.y = (canvas_height - this.height) / 2;
  };

  this.moveUp = function() {
    this.y -= this.speed;

    if (this.y < 0) this.y = 0;
  };

  this.moveDown = function() {
    this.y += this.speed;

    if (this.y > canvas_height - this.height) {
      this.y = canvas_height - this.height;
    }
  };

  this.draw = function() {
    RectanglePlein(this.x, this.y, this.width, this.height, "blue");
  };
}

function InitRackets() {
  racket1 = new Racket();
  racket2 = new Racket();

  //on prend en compte la hauteur qui a pu être modifiée par l'utilisateur avec l'éditeur de niveau
  racket1.height = current_level_config.racket_length;
  racket2.height = current_level_config.racket_length;

  racket1.setLeft();
  racket2.setRight();
}


/* ------------------------------ Gestion des balles -------------------------------- */


var ball1, ball2;

function Ball() {
  this.x = 0;
  this.y = 0;
  this.r = 30;

  this.speed = 0;
  this.min_speed_x = 0.3;

  this.setLeft = function() {
    this.x = current_level_config.brick_area_margin.left / 2;
    this.y = canvas_height / 2;

    this.speed = {
      x: -this.speed,
      y: 0
    };
  };

  this.setRight = function() {
    this.x = canvas_width - (current_level_config.brick_area_margin.right / 2);
    this.y = canvas_height / 2;

    this.speed = {
      x: this.speed,
      y: 0
    };
  };

  this.move = function() {
    this.x += this.speed.x;
    this.y += this.speed.y;

    if (this.x - this.r <= 0 || this.x + this.r >= canvas_width) {
      if (cheat) {
        this.speed.x = -this.speed.x;
      } else {
        lifes--;

        if (lifes == 0) {
          loser_player = (this.x - this.r <= 0) ? 1 : 2;
          setupGameOver();
          game.status = game_status.OVER;
        } else {
          InitRackets();
          InitBalls();
          delayGameStart();
        }
      }
    }

    if (this.y - this.r <= 0 || this.y + this.r >= canvas_height) {
      this.speed.y *= -1;

      //si la vitesse x est nulle (quasi impossible) on la fait partir à gauche ou à droite selon où elle est dans l'écran
      if (this.speed.x == 0 && this.x <= canvas_width / 2) {
        this.speed.x = -1;
      } else if (this.speed.x == 0) {
        this.speed.x = 1;
      }

      //si balle va à droite pas assez rapidement, on lui donne un petit boost
      if (this.speed.x > 0 && this.speed.x <= this.min_speed_x) {
        this.speed.x = 1;
      }

      //pareil dans l'autre sens
      if (this.speed.x < 0 && this.speed.x >= -this.min_speed_x) {
        this.speed.x = -1;
      }
    }
  };

  this.draw = function() {
    DrawImageObject(img_ball, this.x - this.r, this.y - this.r, this.r * 2, this.r * 2);
  };
}

function InitBalls() {
  ball1 = new Ball();
  ball2 = new Ball();

  ball1.speed = current_level_config.ball_speed;
  ball2.speed = current_level_config.ball_speed;

  ball1.setLeft();
  ball2.setRight();
}


/* -------------------------------- Gestion clavier ---------------------------------- */


/* Dans ce mode principal :
 - le Joueur 1 joue avec Z et S et contrôle la raquette gauche (racket1)
 - le Joueur 2 joue avec O et L et contrôle la raquette droite (racket2) */

function HandleGameKeyboard() {
  if (map[keys.Z]) racket1.moveUp();
  if (map[keys.S]) racket1.moveDown();
  if (map[keys.O]) racket2.moveUp();
  if (map[keys.L]) racket2.moveDown();
}


/* ------------------------------------ Gestion des collisions -------------------------------------- */


//calcule le vecteur normal à une surface ayant un angle particulier

function getNormal(a) {
  return {
    x: Math.sin(a),
    y: -Math.cos(a)
  };
}

//calcule le vecteur vitesse après collision avec une surface dont le vecteur normal est donné

function reflect(normal, vect) {
  var d = 2 * dot(vect, normal);
  vect.x -= d * normal.x;
  vect.y -= d * normal.y;
}

//calcule le produit scalaire de 2 vecteurs

function dot(v1, v2) {
  return v1.x * v2.x + v1.y * v2.y;
}

/* Technique de calcul de l'angle de réflexion :
- calcul différence entre centres y de la raquette et de la balle
- calcul du ratio de la différence par rapport à la demi-hauteur d'une raquette : plus la balle est éloignée du centre, plus elle dévie de la normale de la raquette
- calcul de l'angle de déviation en multipliant le ratio par l'angle de déviation maximal
- on ajoute ou retire cet angle de déviation à la normale de la raquette */

var max_deviation = 20 * (Math.PI / 180);

function getReflectionAngle(normalAngle, ball, racket) {
  var racket_center_y = racket.y + racket.height / 2;
  var delta = racket_center_y - ball.y;

  var ratio = delta / (racket.height / 2);
  var deviation = ratio * max_deviation;

  return normalAngle - Math.sign(normalAngle) * deviation;
}

var side = {
  left: 0,
  right: 1
};

function collisionWithRacket(onSide, ball, racket) {
  if (onSide == side.right) { //sur le côté droit de la raquette (donc pour la raquette gauche)
    return ball.speed.x < 0 && (ball.x - ball.r + ball.speed.x <= racket.x + racket.width) && (ball.y + ball.r >= racket.y) && (ball.y - ball.r <= racket.y + racket.height);
  }

  if (onSide == side.left) { //sur le côté gauche de la raquette (donc pour la raquette droite) 
    return ball.speed.x > 0 && (ball.x + ball.r + ball.speed.x >= racket.x) && (ball.y + ball.r >= racket.y) && (ball.y - ball.r <= racket.y + racket.height);
  }
}

function PowerupHitTest(racket, powerup) {
  if (powerup && (powerup.y > racket.y) && (powerup.y < racket.y + racket.height)) {
    var previous_height = racket.height;

    if (powerup.good) {
      racket.setHeight(racket.height * 2);
    } else {
      racket.setHeight(racket.height / 2);
    }

    setTimeout(function() {
      racket.setHeight(previous_height);
    }, 6000);

    if (powerup == powerup1) powerup1 = undefined;
    if (powerup == powerup2) powerup2 = undefined;
  }
}

function RacketHitTest() {
  PowerupHitTest(racket1, powerup1);
  PowerupHitTest(racket2, powerup2);

  if (collisionWithRacket(side.right, ball1, racket1)) {
    reflect(getNormal(getReflectionAngle(Math.HALF_PI, ball1, racket1)), ball1.speed);
  }

  if (collisionWithRacket(side.left, ball1, racket2)) {
    reflect(getNormal(getReflectionAngle(-Math.HALF_PI, ball1, racket2)), ball1.speed);
  }

  if (collisionWithRacket(side.right, ball2, racket1)) {
    reflect(getNormal(getReflectionAngle(Math.HALF_PI, ball2, racket1)), ball2.speed);
  }

  if (collisionWithRacket(side.left, ball2, racket2)) {
    reflect(getNormal(getReflectionAngle(-Math.HALF_PI, ball2, racket2)), ball2.speed);
  }
}

function BrickHitTest(brick, ball) {
  if (((ball.y + ball.r >= brick.y) && (ball.y - ball.r <= brick.y + brick.height) && (ball.x + ball.r >= brick.x - ball.speed.x) && (ball.x + ball.r <= brick.x + ball.speed.x) || (ball.y + ball.r >= brick.y) && (ball.y - ball.r <= brick.y + brick.height) && (ball.x - ball.r <= brick.x + brick.width - ball.speed.x) && (ball.x - ball.r >= brick.x + brick.width + ball.speed.x)) && brick.state != 0) {
    brick.hit();
    if (!cheat) ball.speed.x *= -1; //on applique la collision seulement si le cheat n'est pas activé
  }

  if (((ball.x + ball.r >= brick.x) && (ball.x - ball.r <= brick.x + brick.width) && (ball.y + ball.r >= brick.y - ball.speed.y) && (ball.y + ball.r <= brick.y + ball.speed.y) || (ball.x + ball.r >= brick.x) && (ball.x - ball.r <= brick.x + brick.width) && (ball.y - ball.r <= brick.y + brick.height - ball.speed.y) && (ball.y - ball.r >= brick.y + brick.height + ball.speed.y)) && (brick.state != 0)) {
    brick.hit();
    if (!cheat) ball.speed.y *= -1;
  }
}


/* ------------------------------------- [ STATUS = PAUSED ] ------------------------------------------ */


pause_menu_size = {
  width: 500,
  height: 500
};

var pause_buttons = [];

var menu_pause_y, pause_text_x;

function setupPauseMenu() {
  var size = {
    width: 320,
    height: 90
  };

  setFont('Helvetica', 50);

  menu_pause_y = (canvas_height - pause_menu_size.height) / 2;
  pause_text_x = (canvas_width - getTextWidth("Pause")) / 2;

  pause_buttons[0] = new Button(size, white_button_colors, "Reprendre", "black", 38);
  pause_buttons[0].centerHorizontally(340);
  pause_buttons[0].onClick = function() {
    game.status = game_status.RUNNING;
  };

  pause_buttons[1] = new Button(size, white_button_colors, "Recommencer", "black", 38);
  pause_buttons[1].centerHorizontally(460);
  pause_buttons[1].onClick = function() {
    setupGame();
    game.stage = game_stage.GAME;
    game.status = game_status.RUNNING;
  };

  pause_buttons[2] = new Button(size, white_button_colors, "Retour au menu", "black", 38);
  pause_buttons[2].centerHorizontally(580);
  pause_buttons[2].onClick = function() {
    setupMenuListeners();
    game.stage = game_stage.MENU;
  };
}

function setupPauseMenuListeners() {
  onmousedown = function(e) {
    for (var i = 0; i < pause_buttons.length; i++) {
      pause_buttons[i].testAndSetState(mouseX, mouseY, btn_state.DOWN);
    }
  };

  onmouseup = function(e) {
    for (var i = 0; i < pause_buttons.length; i++) {
      pause_buttons[i].testAndSetState(mouseX, mouseY, btn_state.UP);
    }
  };
}

function drawPauseMenu() {
  RectanglePlein((canvas_width - pause_menu_size.width) / 2, menu_pause_y, pause_menu_size.width, pause_menu_size.height, "grey");
  Rectangle((canvas_width - pause_menu_size.width) / 2, menu_pause_y, pause_menu_size.width, pause_menu_size.height, "black");

  setFont('Helvetica', 50);
  Texte(pause_text_x, menu_pause_y + 80, "Pause", "white");

  for (var i = 0; i < pause_buttons.length; i++) {
    if (pause_buttons[i].state != btn_state.DOWN) {
      pause_buttons[i].testAndSetState(mouseX, mouseY, btn_state.HOVER);
    }

    pause_buttons[i].draw();
  }
}


/* ----------------------------------------- [ STATUS = OVER ] ----------------------------------------------- */


var game_over_buttons = [];
var loser_player;

function setupGameOverListeners() {
  onmousedown = function(e) {
    for (var i = 0; i < game_over_buttons.length; i++) {
      game_over_buttons[i].testAndSetState(mouseX, mouseY, btn_state.DOWN);
    }
  };

  onmouseup = function(e) {
    for (var i = 0; i < game_over_buttons.length; i++) {
      game_over_buttons[i].testAndSetState(mouseX, mouseY, btn_state.UP);
    }
  };
}

var texts;

function setupGameOver() {
  var size = {
    width: 320,
    height: 90
  };

  texts = [];

  texts[0] = new Text("GAME OVER", 100);
  texts[0].centerHorizontally(180);

  texts[1] = new Text("Score : " + score, 40);
  texts[1].centerHorizontally(300);

  if (!cheated && !game_config.best_scores.includes(score)) {
    game_config.best_scores.push(score);
    game_config.best_scores.sort(sortNumberDescending);
    game_config.best_scores = game_config.best_scores.slice(0, 5); //garde les 5 premiers scores
    saveConfigFile();
  }

  texts[2] = new Text(loser_player == 0 ? "Bravo, vous avez gagné !" : "Joueur " + loser_player + " a perdu.", 40);
  texts[2].centerHorizontally(360);

  if (loser_player == 0) {
    game_over_buttons[0] = new Button(size, white_button_colors, "Continuer", "black", 38);
    game_over_buttons[0].centerHorizontally(460);
    game_over_buttons[0].onClick = function() {
      selectNextLevel();

      setupGame();
      game.status = game_status.RUNNING;
      game.stage = game_stage.GAME;
    };

    game_over_buttons[1] = new Button(size, white_button_colors, "Recommencer", "black", 38);
    game_over_buttons[1].centerHorizontally(590);
    game_over_buttons[1].onClick = function() {
      setupGame();
      game.status = game_status.RUNNING;
    };

    game_over_buttons[2] = new Button(size, white_button_colors, "Retour au menu", "black", 38);
    game_over_buttons[2].centerHorizontally(720);
    game_over_buttons[2].onClick = function() {
      setupMenuListeners();
      game.stage = game_stage.MENU;
    };
  } else {
    game_over_buttons[0] = new Button(size, white_button_colors, "Recommencer", "black", 38);
    game_over_buttons[0].centerHorizontally(460);
    game_over_buttons[0].onClick = function() {
      setupGame();
      game.status = game_status.RUNNING;
    };

    game_over_buttons[1] = new Button(size, white_button_colors, "Retour au menu", "black", 38);
    game_over_buttons[1].centerHorizontally(590);
    game_over_buttons[1].onClick = function() {
      setupMenuListeners();
      game.stage = game_stage.MENU;
    };
  }

  setupGameOverListeners();
}

function drawGameOver() {
  Clear("black");

  for (var i = 0; i < texts.length; i++) {
    texts[i].draw();
  }

  for (i = 0; i < game_over_buttons.length; i++) {
    if (game_over_buttons[i].state != btn_state.DOWN) {
      game_over_buttons[i].testAndSetState(mouseX, mouseY, btn_state.HOVER);
    }

    game_over_buttons[i].draw();
  }
}


/* -------------------------------------- [ STAGE = IN BRICK ] ---------------------------------------- */


var FRICTION_COEFF = 0.95;
var BOUNCE = 0.3;

function Spritesheet(sheet_img, frame_count, start) {
  this.frameWidth = sheet_img.width / frame_count;
  this.frameHeight = sheet_img.height;

  this.currFrame = start;

  this.nextSprite = function() {
    this.currFrame = (this.currFrame + 1) % (frame_count - start);
  };

  this.drawFrame = function(i) {
    ctx.drawImage(sheet_img, i * this.frameWidth, 0, this.frameWidth, this.frameHeight, -this.frameWidth / 2, -this.frameHeight / 2, this.frameWidth, this.frameHeight);
  };
  
  this.draw = function() {
    this.drawFrame(this.currFrame + start);
  };
}

//vaisseau avec inertie

function Ship() {
  this.pos = {
    x: 200,
    y: 200
  };

  this.speed = {
    x: 0,
    y: 0
  };

  this.boostForce = 1.3;
  this.rotateSpeed = 0.12;

  this.isBoosting = false;

  this.rotation = 0;
  this.radius = 26;

  this.boost = function() {
    this.speed.x += this.boostForce * Math.cos(this.rotation);
    this.speed.y += this.boostForce * Math.sin(this.rotation);
  };

  this.rotate = function(i) {
    this.rotation += Math.sign(i) * this.rotateSpeed;
  };

  this.move = function() {
    if (this.isBoosting) {
      this.boost();
    }

    this.pos.x += this.speed.x;
    this.pos.y += this.speed.y;

    this.speed.x *= FRICTION_COEFF;
    this.speed.y *= FRICTION_COEFF;

    if (this.pos.x > canvas_width - this.radius) {
      this.speed.x *= -BOUNCE;
      this.pos.x = canvas_width - this.radius;
    }

    if (this.pos.x < this.radius) {
      this.speed.x *= -BOUNCE;
      this.pos.x = this.radius;
    }

    if (this.pos.y > canvas_height - this.radius) {
      this.speed.y *= -BOUNCE;
      this.pos.y = canvas_height - this.radius;
    }

    if (this.pos.y < this.radius) {
      this.speed.y *= -BOUNCE;
      this.pos.y = this.radius;
    }
  };

  this.draw = function() {
    //on garde en mémoire les translations et rotations de base
    ctx.save();

    //on va à la position du vaisseau et on tourne
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.rotation);

    if (this.isBoosting) {
      ship_boost_spritesheet.draw();

      addInterval('ship', function() {
        ship_boost_spritesheet.nextSprite();
      }, 100);      
    } else if (!this.isBoosting) {
      ship_boost_spritesheet.drawFrame(0);
      removeInterval('ship');
    }

    //on restore ce qu'on a gardé en mémoire au début
    ctx.restore();
  };
}

function Friend() {
  this.pos = {
    x: canvas_width / 2,
    y: canvas_height / 2
  };

  this.speed = 5;

  this.radius = 40;
  this.diameter = this.radius * 2;

  this.draw = function() {
    DrawImageObject(img_flying_saucer, this.pos.x - this.radius, this.pos.y - this.radius, this.diameter, this.diameter);
  };
}

function Enemy() {
  constructor(health) {
    this.health = health;
  }
  
  this.pos = {
    x: canvas_width / 2,
    y: canvas_height / 2
  };

  this.minMoveTime = 800;
  this.maxMoveTime = 2000;

  this.speed = {
    x: 1,
    y: 0
  };

  this.minSpeed = 1;
  this.maxSpeed = 2.5;

  this.thisMoveTime = 0;
  this.lastMoveTime = (new Date()).getTime();
  this.nextMoveTime = Random(this.minMoveTime, this.maxMoveTime);
  
  this.radius = 140;

  this.hit = function() {
    this.health -= dmgToEnemy;

    in_brick_score += 10;

    if (this.health < 0) {
      this.health = 0;
    }
  };

  this.getRandomSpeed = function() {
    return {
      x: (Random(0, 1) ? -1 : 1) * Random(this.minSpeed, this.maxSpeed),
      y: (Random(0, 1) ? -1 : 1) * Random(this.minSpeed, this.maxSpeed)
    };
  };

  this.move = function() {
    if (cheat) return;

    this.thisMoveTime = (new Date()).getTime();

    if (this.thisMoveTime - this.lastMoveTime > this.nextMoveTime) {
      this.speed = this.getRandomSpeed();

      this.nextMoveTime = Random(this.minMoveTime, this.maxMoveTime);
      this.lastMoveTime = this.thisMoveTime;
    }

    this.pos.x += this.speed.x;
    this.pos.y += this.speed.y;

    if (this.pos.x <= this.radius) {
      this.speed.x = Random(this.minSpeed, this.maxSpeed);
      this.nextMoveTime = this.maxMoveTime * 2;
    }

    if (this.pos.x >= canvas_width - this.radius) {
      this.speed.x = -Random(this.minSpeed, this.maxSpeed);
      this.nextMoveTime = this.maxMoveTime * 2;
    }

    if (this.pos.y <= this.radius) {
      this.speed.y = Random(this.minSpeed, this.maxSpeed);
      this.nextMoveTime = this.maxMoveTime * 2;
    }

    if (this.pos.y >= canvas_height - this.radius) {
      this.speed.y = -Random(this.minSpeed, this.maxSpeed);
      this.nextMoveTime = this.maxMoveTime * 2;
    }
  };
  
  var rotation = 0;
  var i = 0;
  
  addInterval('enemy', function() {
    rotation = Math.cos(i);
    i = (i + 1) % 4;
  }, 100);
  
  this.draw = function() {
    ctx.save();

    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(rotation);

    ctx.drawImage(img_ring, 0, 0, img_ring.width, img_ring.height, -this.radius, -this.radius, this.radius * 2, this.radius * 2);

    ctx.restore();
  };
}

var ship, friend, enemy, lastShotTime, thisShotTime;
var bullets, bullet_speed = 8;
var special_brick, snapshot_brick;
var original_center, background_center;

var i, vi, vcx, ccx, vcy, ccy; //pour la transition (n'essayez pas de comprendre les noms des variables...)
var snapshots, useSnapshot; //contient les étapes de la transition, que l'on pourra utiliser à l'envers pour la fermeture, et à l'endroit pour une réouverture...
var dmgToEnemy = 5;

var in_brick_stage = -1;

//les étapes possibles du mini-jeu
var in_brick_stages = {
  OPEN_TRANSITION: 0,
  INSTRUCTIONS: 1,
  COUNTDOWN: 2,
  GAME: 3,
  CLOSE_TRANSITION: 4
};

var start_in_brick_text;
var in_brick_score;

var ship_boost_spritesheet;

function setupInBrick() {
  i = 0;
  vi = 1;
  vcx = 1;
  vcy = 1;

  in_brick_score = 0;

  cheat = false;
  pauseEnabled = false;
  background_color = "black";

  ship_boost_spritesheet = new Spritesheet(img_spaceship, 5, 1); //il y a 5 images dans le spritesheet : la première (index 0) pour au repos et les suivantes pour l'animation du boost

  start_in_brick_text = new Text("Appuyez sur ESPACE pour commencer...", 40);
  start_in_brick_text.centerHorizontally(240);
  start_in_brick_text.enableTwinkle();

  in_brick_stage = in_brick_stages.OPEN_TRANSITION;

  //si le tableau de snapshots a été fait pour la même brique que maintenant, on refait la même transition sans la calculer -> optimisation
  if (snapshot_brick == special_brick) {
    useSnapshot = true;
  } else {
    useSnapshot = false;
    snapshots = [];
    snapshot_brick = special_brick;
  }

  background_center = {
    x: special_brick.x + special_brick.width / 2,
    y: special_brick.y + special_brick.height / 2
  };

  original_center = {
    x: background_center.x,
    y: background_center.y
  };

  //valeurs calculées avec Excel pour avoir une courbe suivant nos désirs de vitesse de transition
  ccx = 0.00007 * (Math.abs(background_center.x - canvas_width / 2)) + 0.025;
  ccy = 0.0001 * (Math.abs(background_center.y - canvas_height / 2)) + 0.0242;

  ship = new Ship();
  bullets = [];

  friend = new Friend();
  var health = 100;
  
  if (enemy) {
    health = enemy.health;
  }
  
  enemy = new Enemy(health);

  lastShotTime = (new Date()).getTime();
}

var health_bar_size = {
  width: 280,
  height: 60
};

var health_bar_margin = 4;

function drawInBrickScore() {
  setFont("Helvetica", 40);
  Texte(30, 60, "Score : " + in_brick_score, "black");

  setFont("Helvetica", 25);
  Texte(28, 95, "(mini-jeu)", "black");
}

function drawHealthBar() {
  Rectangle((canvas_width - health_bar_size.width) / 2, 50, health_bar_size.width, health_bar_size.height, "white");
  RectanglePlein((canvas_width - health_bar_size.width) / 2 + health_bar_margin, 50 + health_bar_margin, (enemy.health / 100) * (health_bar_size.width - 2 * health_bar_margin), health_bar_size.height - 2 * health_bar_margin, enemy.health < 20 ? "red" : "white");
  setFont('Helvetica', 40);
  Texte(730, 95, "Vie", "white");
}

function isBulletOffscreen(b) {
  return (b.x > canvas_width) || (b.x < 0) || (b.y > canvas_height) || (b.y < 0);
}

function isEnemyShot(b) {
  return getDist(b.pos, enemy.pos) < enemy.radius;
}

function isShipCollidingEnemy() {
  return getDist(ship.pos, enemy.pos) - ship.radius < enemy.radius;
}

function isFriendCollidingEnemy() {
  return getDist(friend.pos, enemy.pos) + friend.radius >= enemy.radius;
}

function updateBullets() {
  for (var i = bullets.length - 1; i >= 0; i--) {
    bullets[i].pos.x += bullets[i].speed * Math.cos(bullets[i].angle);
    bullets[i].pos.y += bullets[i].speed * Math.sin(bullets[i].angle);

    if (isBulletOffscreen(bullets[i])) {
      bullets.splice(i, 1); //quand le missile sort de l'écran, on le supprime du tableau
    } else if (isEnemyShot(bullets[i])) {
      enemy.hit(); //quand le missile fait mouche, on le supprime aussi du tableau
      bullets.splice(i, 1);
    } else {
      CerclePlein(bullets[i].pos.x, bullets[i].pos.y, 8, rgb(22, 211, 244)); //sinon on dessine le missile
    }
  }
}

/* Dans le mini-jeu (InBrick) :
 - le Joueur 1 joue avec Z, Q, D et ESPACE et contrôle le vaisseau (ship)
 - le Joueur 2 joue avec O, K, L et M et contrôle l'acolyte, personnage enfermé dans le cercle (friend) */

function HandleInBrickKeyboard() {
  ship.isBoosting = map[keys.Z];

  if (map[keys.Q]) {
    ship.rotate(-1);
  }

  if (map[keys.D]) {
    ship.rotate(1);
  }

  if (map[keys.Space]) {
    thisShotTime = (new Date()).getTime();

    if (thisShotTime - lastShotTime > 500) { //on limite les tirs à toutes les 500 millisecondes, pour empêcher le spam
      var p = getPointFromCircle(ship.pos, ship.radius, ship.rotation);

      bullets.push({
        speed: bullet_speed + getLength(ship.speed),
        pos: p,
        angle: ship.rotation
      });

      lastShotTime = thisShotTime;
    }
  }

  if (map[keys.O]) {
    friend.pos.y -= friend.speed;
  }

  if (map[keys.K]) {
    friend.pos.x -= friend.speed;
  }

  if (map[keys.L]) {
    friend.pos.y += friend.speed;
  }

  if (map[keys.M]) {
    friend.pos.x += friend.speed;
  }
}

function createAndDoTransition() {
  if (i >= canvas_width && background_center.x == canvas_width / 2 && background_center.y == canvas_height / 2) {
    //quand on a atteint le centre de l'écran, on passe à l'étape suivante
    in_brick_stage = in_brick_stages.INSTRUCTIONS;
    return;
  }

  //i correspond au rayon du cercle quand il est inférieur à canvas_height, et à la largeur de l'ellipse quand il est supérieur ou égal à canvas_height (la hauteur de l'ellipse étant alors canvas_height)
  if (i < canvas_width) {
    i += vi;
    vi += vi * 0.1; //accélération de l'incrémentation de i
  }

  //vcx et vcy s'occupent de ramener le centre du cercle (ou ellipse) au centre de l'écran
  if (original_center.x < canvas_width / 2) {
    if (background_center.x < canvas_width / 2) {
      vcx += vcx * ccx;
      background_center.x += vcx;
    } else {
      background_center.x = canvas_width / 2;
    }
  } else {
    if (background_center.x > canvas_width / 2) {
      vcx += vcx * ccx;
      background_center.x -= vcx;
    } else {
      background_center.x = canvas_width / 2;
    }
  }

  if (original_center.y < canvas_height / 2) {
    if (background_center.y < canvas_height / 2) {
      vcy += vcy * ccy;
      background_center.y += vcy;
    } else {
      background_center.y = canvas_height / 2;
    }
  } else {
    if (background_center.y > canvas_height / 2) {
      vcy += vcy * ccy;
      background_center.y -= vcy;
    } else {
      background_center.y = canvas_height / 2;
    }
  }

  //on enregistre chaque état de la transition pour ne pas avoir à la recalculer la prochaine fois
  snapshots.push({
    x: background_center.x,
    y: background_center.y,
    radius: i
  });

  CerclePlein(background_center.x, background_center.y, i, "black");
}

function doTransition() {
  if (i == snapshots.length - 1) {
    //quand on arrive à la fin du tableau, donc de la transition, on passe à l'étape suivante
    in_brick_stage = in_brick_stages.INSTRUCTIONS;
    return;
  }

  //sinon on incrémente i et on continue la transition
  i++;
  CerclePlein(snapshots[i].x, snapshots[i].y, snapshots[i].radius, "black");
}

function doCloseTransition() {
  if (i == 0) {
    //quand on arrive au début du tableau, donc à la fin de la transition de fermeture, on revient au jeu
    pauseEnabled = true;
    in_brick_stage = -1;

    background_color = "white";
    cheat = false;
    delayGameStart();
    game.stage = game_stage.GAME;

    //on ajoute le score cumulé au cours de ce mini-jeu à celui du jeu principal
    addToScore(in_brick_score);
    return;
  }

  //pour faire la transition de fermeture, on dessine le jeu principal derrière (sans mouvement sauf de la raquette) et on dessine l'ellipse qui rétrécit par-dessus
  drawOnlyGameState();

  i--;
  CerclePlein(snapshots[i].x, snapshots[i].y, snapshots[i].radius, "black");
}

function endInBrick(won) {
  i = snapshots.length; //on peut initialiser i à la taille du tableau, car on le décrémente juste après, juste avant de dessiner le cercle
  //on interdit la pause pendant la transition
  pauseEnabled = false;

  if (won) {
    in_brick_score += 100;
    special_brick.state = 0;
    alive_bricks_count--;
  }

  //on lance la transition de fermeture
  in_brick_stage = in_brick_stages.CLOSE_TRANSITION;
}

function drawInBrickInstructionsOrCountdown() {
  start_in_brick_text.draw();

  drawArrow({
    x: ship.pos.x + 80,
    y: ship.pos.y + 180
  }, {
    x: ship.pos.x + 20,
    y: ship.pos.y + 50
  }, "white");

  setFont('Helvetica', 40);
  Texte(ship.pos.x + 50, ship.pos.y + 250, "Joueur 1", "white");

  setFont('Helvetica', 28);
  Texte(ship.pos.x + 20, ship.pos.y + 300, "- Z pour avancer\n- Q pour pivoter à gauche\n- D pour pivoter à droite\n- ESPACE pour tirer\n\nDétruisez le cercle et sauvez votre acolyte !", "white");

  drawArrow({
    x: friend.pos.x + 180,
    y: friend.pos.y + 100
  }, {
    x: friend.pos.x + 60,
    y: friend.pos.y + 30
  }, "white");

  setFont('Helvetica', 40);
  Texte(friend.pos.x + 230, friend.pos.y + 130, "Joueur 2", "white");

  setFont('Helvetica', 28);
  Texte(friend.pos.x + 200, friend.pos.y + 180, "- O pour monter\n- K pour aller à gauche\n- L pour descendre\n- M pour aller à droite\n\nSuivez les déplacements du cercle pour\nne pas toucher ses parois !", "white");
}

dmgToEnemy = 10;

function drawInBrick() {
  if (in_brick_stage == in_brick_stages.OPEN_TRANSITION) {

    if (useSnapshot) {
      doTransition();
    } else {
      createAndDoTransition();
    }

    return;
  }

  if (in_brick_stage == in_brick_stages.CLOSE_TRANSITION) {
    doCloseTransition();
    return;
  }

  ctx.clearRect(0, 0, canvas_width, canvas_height);
  CerclePlein(canvas_width / 2, canvas_height / 2, canvas_width, background_color);

  if (in_brick_stage == in_brick_stages.GAME) {
    HandleInBrickKeyboard();
    ship.move();
    enemy.move();

    //friend.pos = enemy.pos; //DEBUG
  }

  if (isShipCollidingEnemy() || isFriendCollidingEnemy()) {
    endInBrick(false);
    return;
  }

  drawInBrickScore();
  drawHealthBar();

  ship.draw();
  updateBullets();
  enemy.draw();
  friend.draw();

  if (in_brick_stage == in_brick_stages.INSTRUCTIONS || in_brick_stage == in_brick_stages.COUNTDOWN) {
    drawInBrickInstructionsOrCountdown();

    if (in_brick_stage == in_brick_stages.INSTRUCTIONS && map[keys.Space]) { //test d'appui sur espace si on est dans les instructions (et pas déjà en compte à rebours)
      start_in_brick_text = new Text("3", 60);
      start_in_brick_text.centerHorizontally(240);

      //compte à rebours : 3, 2, 1...
      var count = 3;

      addInterval('countdown', function() {
        if (count == 1) {
          in_brick_stage = in_brick_stages.GAME;
          pauseEnabled = true;
          removeInterval('countdown');
        } else {
          count--;
          start_in_brick_text.text = count;
        }
      }, 1000);

      in_brick_stage = in_brick_stages.COUNTDOWN;
    }
  }

  if (enemy.health == 0) {
    endInBrick(true);
  }
}


/* ----------------------------------------------------- [[ GÉNÉRAL ]] --------------------------------------------------- */


/* Helpers */

function sortLevels(a, b) {
  a = a.replace(".level", "");
  b = b.replace(".level", "");

  var int_a = enEntier(a);
  var int_b = enEntier(b);

  //on veut faire remonter tous les noms de fichiers autres que des chiffres et les classer par ordre alphabétique. Sinon on classe les chiffres dans l'ordre numérique
  if (isNaN(int_a) && isNaN(int_b)) { //comparaison entre 2 strings
    return a > b;
  }

  if (isNaN(int_a)) { //comparaison entre une string et un nombre : on met a avant b avec -1
    return -1;
  }

  if (isNaN(int_b)) { //comparaison entre un nombre et une string : on met b avant a avec 1 
    return 1;
  }

  return int_a - int_b; //comparaison entre 2 nombres
}

function sortNumberDescending(a, b) {
  return b - a;
}

//technique classique pour tester si un point est dans un triangle

function isPointInTriangle(x, y, t) {
  var tArea, t1Area, t2Area, t3Area;
  tArea = triangleArea(t.x1, t.y1, t.x3, t.y3, t.x2, t.y2);
  t1Area = triangleArea(x, y, t.x2, t.y2, t.x3, t.y3);
  t2Area = triangleArea(x, y, t.x3, t.y3, t.x1, t.y1);
  t3Area = triangleArea(x, y, t.x2, t.y2, t.x1, t.y1);
  return (t1Area + t2Area + t3Area == tArea);
}

function getLength(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function getDist(p1, p2) {
  var dx = p2.x - p1.x,
   dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getPointFromCircle(center, radius, angle) {
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle)
  };
}

function triangleArea(x1, y1, x2, y2, x3, y3) {
  return (0.5 * Math.abs(((x1 - x3) * (y2 - y3)) - ((y1 - y3) * (x2 - x3))));
}

function getPreviousFullItemIndex(value, fullItemSize) {
  return Math.round((value - value % fullItemSize) / fullItemSize);
}

function constrain(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function isPointInRect(x, y, rect_x, rect_y, rect_width, rect_height) {
  return (x >= rect_x) && (x <= rect_x + rect_width) && (y >= rect_y) && (y <= rect_y + rect_height);
}

function rad(d) {
  return d * (Math.PI / 180);
}

function getAngle(p1, p2) {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

//retourne un entier aléatoire entre min et max compris

function Random(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

//valeurs remarquables utilisées
Math.HALF_PI = Math.PI / 2;
Math.THIRD_PI = Math.PI / 3;

/* Gestion des évènements utilisateurs */

var map = [];

var keys = {
  P: 80,
  //pause
  //joueur 1
  Z: 90,
  //monter racket1 ou propulser vaisseau
  Q: 81,
  //pivoter vaisseau à gauche
  S: 83,
  //descendre racket1
  D: 68,
  //pivoter vaisseau à droite
  Space: 32,
  //tirer avec le vaisseau
  //joueur 2
  O: 79,
  //monter racket2 ou déplacer personnage en haut (dans cercle)
  K: 75,
  //déplacer personnage à gauche
  L: 76,
  //descendre racket2 ou déplacer personnage en bas
  M: 77,
  //déplacer personnage à droite
  //code KONAMI
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  A: 65,
  B: 66
};

var konamiCode = [keys.UP, keys.UP, keys.DOWN, keys.DOWN, keys.LEFT, keys.RIGHT, keys.LEFT, keys.RIGHT, keys.B, keys.A];
var konamiProgression = 0; //l'index actuel de la progression du code (dans la séquence de touches)
onkeydown = function(e) {
  map[e.keyCode] = e.type == 'keydown';
};

onkeyup = function(e) {
  map[e.keyCode] = e.type == 'keydown';

  if (e.keyCode != konamiCode[konamiProgression]) { //si la touche appuyée ne correspond pas à la touche à l'index actuel dans la séquence de touches alors on reset la progression
    konamiProgression = 0;
    return;
  }

  konamiProgression++;

  if (konamiProgression == konamiCode.length) {
    konamiProgression = 0;
    activateKonami();
  }
};

var cheat, cheated; //cheat indique si on est actuellement en train de tricher, cheated indique si on a triché pendant la partie (cheat revient à false quand on a terminé le mini-jeu en trichant)

function activateKonami() {
  if (game.status == game_status.RUNNING && (game.stage == game_stage.GAME || game.stage == game_stage.IN_BRICK)) {
    cheat = true;
    cheated = true;
    background_color = rgb(96, 125, 139);
    dmgToEnemy = 50;
  }
}

function resetButtonListeners() {
  onmousedown = undefined;
  onmouseup = undefined;

  onmousemove = function(e) {
    updateMousePos(e);
  };
}

var pauseEnabled = true;

//on gère la pause ici

function Keypressed(e) {
  if (e == keys.P && pauseEnabled && (game.stage == game_stage.GAME || game.stage == game_stage.IN_BRICK)) {
    if (game.status == game_status.PAUSED) {
      resetButtonListeners();
      game.status = game_status.RUNNING;
    } else {
      setupPauseMenuListeners();
      game.status = game_status.PAUSED;
    }
  }
}

/* Conversion HSB vers RGB

Cette fonction a été trouvée ici : https://stackoverflow.com/a/17243070 

HSB <=> Hue Saturation Brightness
La fonction prend comme argument h, s et bness, tous compris entre 0 et 1.
Et retourne une couleur RGB. */

function HSBtoRGB(h, s, bness) {
  var r, g, b, i, f, p, q, t;

  i = Math.floor(h * 6);
  f = h * 6 - i;
  p = bness * (1 - s);
  q = bness * (1 - f * s);
  t = bness * (1 - (1 - f) * s);

  switch (i % 6) {
  case 0:
    r = bness, g = t, b = p;
    break;
  case 1:
    r = q, g = bness, b = p;
    break;
  case 2:
    r = p, g = bness, b = t;
    break;
  case 3:
    r = p, g = q, b = bness;
    break;
  case 4:
    r = t, g = p, b = bness;
    break;
  case 5:
    r = bness, g = p, b = q;
    break;
  }

  return rgb(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}

/* Dessin d'un triangle */

var p1, p2, p3;

function drawTriangle(center, radius, rotation, color) {
  p1 = getPointFromCircle(center, radius, rotation);
  p2 = getPointFromCircle(center, radius, rotation + 2 * Math.THIRD_PI);
  p3 = getPointFromCircle(center, radius, rotation + 4 * Math.THIRD_PI);

  PolygonePlein(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, color);
}

/* Dessin d'un coeur */

//points de la moitié gauche d'un coeur, on prend la symétrie pour la droite
var heart_points = [
  [0, 1],
  [1.3, 0],
  [1.4, -0.7],
  [1, -1.2],
  [0.45, -1.35],
  [0, -1]
];

var heart_flare = [
  [0.68, -1],
  [0.8, -0.7],
  [1.1, -0.75]
];

//on met les coeurs à l'échelle, une seule fois au lancement du jeu
var heart_scale = 25;

function scaleHeart() {
  for (var i = 0; i < heart_points.length; i++) {
    heart_points[i][0] *= heart_scale;
    heart_points[i][1] *= heart_scale;
  }
  
  for (i = 0; i < heart_flare.length; i++) {
    heart_flare[i][0] *= heart_scale;
    heart_flare[i][1] *= heart_scale;
  }
}

function drawHeart(x, y) {
  PolygonePlein(x + heart_points[0][0], y + heart_points[0][1], x + heart_points[1][0], y + heart_points[1][1], x + heart_points[2][0], y + heart_points[2][1], x + heart_points[3][0], y + heart_points[3][1], x + heart_points[4][0], y + heart_points[4][1], x + heart_points[5][0], y + heart_points[5][1], x - heart_points[4][0], y + heart_points[4][1], x - heart_points[3][0], y + heart_points[3][1], x - heart_points[2][0], y + heart_points[2][1], x - heart_points[1][0], y + heart_points[1][1], "red");
  PolygonePlein(x + heart_flare[0][0], y + heart_flare[0][1], x + heart_flare[1][0], y + heart_flare[1][1], x + heart_flare[2][0], y + heart_flare[2][1], "white");
}

/* Dessin d'une flèche */

var p1, p2, p3, p4, p5, p6;

//flèche dont les points sont entièrements définis de manière polaire, de façon à pouvoir lui appliquer un rayon et une rotation

function drawArrow(start, target, color) {
  var r = getDist(start, target) / 2;
  var rotation = getAngle(start, target);

  var center = {
    x: target.x - r * Math.cos(rotation),
    y: target.y - r * Math.sin(rotation)
  };

  p1 = getPointFromCircle(center, r / 2, rotation + rad(45));
  p2 = getPointFromCircle(center, r / 2, rotation + rad(5));
  p3 = getPointFromCircle(center, r, rotation + rad(175));
  p4 = getPointFromCircle(center, r, rotation + rad(185));
  p5 = getPointFromCircle(center, r / 2, rotation + rad(-5));
  p6 = getPointFromCircle(center, r / 2, rotation + rad(-45));

  PolygonePlein(target.x, target.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y, p5.x, p5.y, p6.x, p6.y, color);
}

/* Styles */

var red_button_colors = [HSBtoRGB(0, 1, 1), HSBtoRGB(0, 1, 0.8), HSBtoRGB(0, 1, 0.6)];
var green_button_colors = [HSBtoRGB(0.33, 1, 0.5), HSBtoRGB(0.33, 1, 0.4), HSBtoRGB(0.33, 1, 0.3)];
var white_button_colors = [HSBtoRGB(0, 0, 1), HSBtoRGB(0, 0, 0.8), HSBtoRGB(0, 0, 0.6)];

/* Correction curseur main pour Chrome */

var isChrome = !! (window.chrome) && !! (window.chrome.webstore); //expression booléenne trouvée ici : https://stackoverflow.com/a/9851769
var cursor_grab = "grab";
var cursor_grabbing = "grabbing";

if (isChrome) {
  cursor_grab = "-webkit-grab";
  cursor_grabbing = "-webkit-grabbing";
}

/* Mise à l'échelle */

function setFont(name, size) {
  setCanvasFont(name, (size * size_canvas_x / canvas_width) + 'px', '');
}

function getTextWidth(text) {
  return ctx.measureText(text).width * (canvas_width / size_canvas_x);
}

function updateMousePos(e) {
  mouseX = e.target.id == "mycanvas" ? e.layerX * (maxviewport_x - minviewport_x) / size_canvas_x + minviewport_x : 0;
  mouseY = e.target.id == "mycanvas" ? e.layerY * (maxviewport_y - minviewport_y) / size_canvas_y + minviewport_y : 0;
}

/* Initialisation des sprites */

var img_spaceship = PreloadImage(readFile('Data/spaceship.png'));
var img_ring = PreloadImage(readFile('Data/ring.png'));
var img_flying_saucer = PreloadImage(readFile('Data/flying_saucer.png'));
var img_ball = PreloadImage(readFile('Data/ball.png'));

/* Gestion des setInterval() */

var intervals;

function addInterval(name, func, interval) {
  if (!intervals[name]) {
    intervals[name] = setInterval(func, interval);
  }
}

function removeInterval(name) {
  if (!intervals[name]) return;

  clearInterval(intervals[name]);
  delete intervals[name];
}

function removeAllIntervals() {
  for (var name in intervals) {
    removeInterval(name);
  }
}

/* Debug et divers */

GEBID('mycanvas').oncontextmenu = function() { //empêche le menu contextuel de s'ouvrir quand on fait clic droit sur le canvas : utile pour le clic droit sur les briques dans l'éditeur de niveau
  return false;
};

function Clear(color) {
  RectanglePlein(0, 0, canvas_width, canvas_height, color);
}

function loadLevel() {
  if (window.localStorage[game_config_filename]) {
    current_level_filename = game_config.selectedLevelFilename;

    if (window.localStorage[current_level_filename]) {
      current_level_config = readLevelFile(current_level_filename);
      return;
    }
  }

  current_level_filename = level_one_filename;
  current_level_config = createLevelOne();
}

//il peut y avoir combinaison d'un statut et d'une étape, par exemple : GAME & RUNNING, ou IN_BRICK & PAUSED
//statuts possibles pour les jeux
var game_status = {
  RUNNING: 0,
  PAUSED: 1,
  OVER: 2
};

//états du programme
var game_stage = {
  MENU: 0,
  LEVEL_LIST: 1,
  LEVEL_EDITOR: 2,
  GAME: 3,
  IN_BRICK: 4,
  INSTRUCTIONS: 5
};

var game = {
  status: game_status.RUNNING,
  stage: game_stage.MENU
};

/*var game = { //DEBUG
  status: game_status.RUNNING,
  stage: game_stage.GAME
};*/

debug_in_brick = -1; //donner une valeur > -1 pour forcer une brique spéciale
var canvas_width, canvas_height;

FrameRate = 60;

WaitPreload(function() {
  Loop(-1);
});


/* -------------------------------- // -------------------------------- \\ ------------------------------ */
/* -------------------------------- || COEUR DU JEU : setup() et loop() || ------------------------------ */
/* -------------------------------- \\ -------------------------------- // ------------------------------ */


function setup() {
  //le design a été fait pour cette taille de canvas
  canvas_width = 1920;
  canvas_height = 920;

  Viewport(0, 0, canvas_width, canvas_height, 1);

  //on initialise l'objet contenant tous les id des setInterval()
  if (!intervals)
    intervals = {};
  
  //si certains setInterval() tournent encore, on les reset tous
  removeAllIntervals();
  
  //on initialise les coeurs et les listeners
  scaleHeart();
  resetButtonListeners();

  //on charge la configuration du jeu
  loadConfigFile();

  //on charge le niveau pour lancer le jeu : soit on crée le niveau 1, soit on charge le niveau stocké dans la configuration du jeu 
  loadLevel();

  setupMenu();
  setupInstructions();
  setupPauseMenu();

  //le jeu devrait toujours commencer avec le MENU, mais quand on veut faire un changement, il peut être intéressant de commencer l'exécution autre part, dans l'éditeur de niveau par exemple, alors il y a plusieurs façons de setup()...
  if (game.stage == game_stage.MENU) {
    setupMenuListeners();
  }

  if (game.stage == game_stage.LEVEL_LIST) {
    setupLevelList();
  }

  if (game.stage == game_stage.LEVEL_EDITOR) {
    editor_level_config = getDefaultLevel();
    setupLevelEditor();
  }

  if (game.stage == game_stage.GAME) {
    setupGame();
    setupPauseMenuListeners();

    if (game.status == game_status.OVER) {
      setupGameOver();
    }
  }

  if (game.stage == game_stage.IN_BRICK) {
    special_brick = new Brick(0, 0);
    setupGame();
    setupInBrick();
  }
}

function draw() {

  //on dessine les différents stages du jeu suivant ce qui est sélectionné
  switch (game.stage) {

  case game_stage.MENU:

    drawMenu();

    break;

  case game_stage.LEVEL_LIST:

    drawLevelList();

    break;

  case game_stage.LEVEL_EDITOR:

    drawLevelEditor();

    break;

  case game_stage.GAME:

    if (game.status == game_status.PAUSED) {
      drawPauseMenu();
    } else if (game.status == game_status.OVER) {
      drawGameOver();
    } else {
      drawGame();
    }

    break;

  case game_stage.IN_BRICK:

    if (game.status == game_status.PAUSED) {
      drawPauseMenu();
    } else if (game.status == game_status.OVER) {
      drawGameOver();
    } else {
      drawInBrick();
    }

    break;

  case game_stage.INSTRUCTIONS:

    drawInstructions();

    break;
  }
}
