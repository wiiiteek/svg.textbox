/*! svg.textbox.js - v0.9.0 - 2017-07-27
* https://github.com/wiiiteek/svg.textbox#readme
* Copyright (c) 2017 Wiktor Koźmiński
* Licensed MIT */
SVG.MText = SVG.invent({
  create: function() {
    this.constructor.call(this, SVG.create('text'));
    this.dom.lineHeight = new SVG.Number(1.2);
    this.attr('font-family', SVG.defaults.attrs['font-family']);
    this.data('text-width', 200);

    var defaultSize = SVG.defaults.attrs['font-size'] ? SVG.defaults.attrs['font-size'] : '12px';
    this.attr('font-size', defaultSize);
    this.attr('multiline', true);
  },

  inherit: SVG.Shape,

  extend: {
    width: function(value) {
      if (typeof value === 'undefined') { return this.data('text-width'); }
      this.data('text-width', value);
      this.breakLines(this.width());
    },

    aligin: function(value) {
      if (typeof value === 'undefined') { return this.attr('text-anchor'); }
      this.attr('text-anchor', value);
      this.adjustLines();
    },

    clear: function() {
      while (this.node.hasChildNodes())
        this.node.removeChild(this.node.lastChild);

      return this;
    },

    /**
     * Starts new text line. Creates new tspan marked as "newline"
     * @param  {String|Function} text
     * @return {SVG.Tspan}       tspan line instance
     */
    line: function(text) {
      if (typeof text === 'undefined') { return; }

      var span = new SVG.Tspan();
      span.attr('newline', true);
      this.node.appendChild(span.node);
      
      if (typeof text === 'function') {
        text.call(this, span);
      } else {
        span.tspan(text);
      }

      this.breakLine(span, this.width());
      this.adjustLines();

      return span;
    },

    adjustLines: function() {
      var lastDy = 0;
      var lastMargin = 0;
      var _self = this;
      var x = this.attr('x');
      if (this.attr('text-anchor') == 'middle')
        x = this.attr('x') + this.width()/2;
      else if(this.attr('text-anchor') == 'end')
        x = this.attr('x') + this.width();

      this.lines().each(function() {
        var fSize = _self.getBiggestFont(this);
        var marginBottom = (fSize * _self.dom.lineHeight - fSize)/2;
        var dy = lastMargin*2 + fSize;

        // console.log("Font size: %d, margin: %d", fSize, marginBottom);

        this.attr('dy', dy);
        this.attr('x', x);

        lastDy = dy;
        lastMargin = marginBottom;
      });
    },

    breakLines: function(width) {
      var _self = this;
      this.connectBrokenLines();
      this.lines().each(function() {
        _self.breakLine(this, width);
      });
      this.adjustLines();
    },

    /**
     * Breaks given text line (wraps words)
     * Also wraps plain text into (tspan tags)
     * and removes everything else (@todo rethink this)
     *
     * @throws Exception if line node is not a SVGTSpanElement
     *
     * @param  {SVG.Tspan} line
     * @param  {Number}    width wrap length
     * @return {void}
     */
    breakLine: function(line, width) {
      if (!(line.node instanceof SVGTSpanElement)) {
        throw Exception('Given line is not SVG Tspan element!');
      }

      this.wrapPlainText(line);

      var lineLen = line.node.getComputedTextLength();
      if (lineLen <= width) { return; }

      // console.log("---- Starting breaking: %d > %d (width) ----", lineLen, width);

      var childs = line.node.childNodes;
      var tmpLen = 0;
      var watchdog = 0;
      var breakSpanIndex = -1;

      for (var i = 0; i < childs.length; i++) {

        watchdog++;
        if (watchdog > 100) {
          throw Exception('Watchdog limit reached! Something is wrong with break line "for" loop!');
        }

        var n = childs[i];
        if (n.nodeName !== 'tspan') { n.remove(); continue; } // @todo rethink

        tmpLen = tmpLen + n.getComputedTextLength();
        // console.log("Iterating %d from %d, checking if len: %d < %d", i+1, childs.length, tmpLen, width);
        if (tmpLen < width) { continue; }

        var span2 = this.breakSpanIntoTwo(n);
        if (span2 === null) { 
          breakSpanIndex = (i < 1 && childs.length > 1) ? i+1 : i;
          break;
        }

        // reset loop
        childs = line.node.childNodes;
        i = -1;
        tmpLen = 0;
      }
      
      // if break index == 0 that means there is only one word in line and it cant be broken into smaller pieces!
      if (breakSpanIndex < 1) { return; }

      // console.log("Break on index %d which is: %s", breakSpanIndex, childs[breakSpanIndex].textContent);
      // create new line
      var newline = SVG.adopt(line.node.cloneNode());
      newline.data('connected-with-line', line.id());
      newline.id(SVG.eid(newline.node.nodeName));
      line.node.parentNode.insertBefore(newline.node, line.node);

      // put oter spans into new line
      var childsToMove = [];
      for (var y = 0; y < breakSpanIndex; y++) {
        childsToMove.push(childs[y]);
      }

      childsToMove.map(function(ch) { return newline.node.appendChild(ch); });

      // connect tspan in this line which can be connected
      // and recursive call same fun on new line
      this.connectBrokenWordsInLine(newline);
      this.breakLine(line, width);
      this.connectBrokenWordsInLine(line);
      this.adjustLines();
      
      // console.log("---- END breaking ----");
    },

    breakSpanIntoTwo: function(spanNode) {
      var parentNode = spanNode.parentNode;
      var words = spanNode.textContent.split(' ').filter(function (w){ return (w !== '' && w.length > 0); });
      
      // console.log(words);
      if (words.length < 2) {
        return null;
      }

      spanNode.innerHTML = "";
      // var span2 = childs[i].clone().node; @fixme: clone(). does not work on tspan elements (index() exactly)
      var span2 = spanNode.cloneNode(true);
      parentNode.insertBefore(span2, spanNode.nextSibling);
      SVG.adopt(span2).id(SVG.eid(span2.nodeName));
      SVG.adopt(span2).data('connect-prev', true);
      SVG.adopt(spanNode).data('connect-next', true);

      for (var j = 0; j < words.length; j++) {
        if (words[j] === '') { continue; }
        if (j+1 <= words.length/2 ) {
          spanNode.innerHTML = spanNode.innerHTML + words[j] + ' ';
        } else {
          span2.innerHTML = span2.innerHTML + words[j] + ' ';
        }
      }

      return span2;
    },

    /**
     * Connects spans created by breakSpanIntoTwo() method
     * Reduces unecessery tspans
     * @param  {SVG.Tspan} line
     * @return {void}
     */
    connectBrokenWordsInLine: function(line) {
      var childs = line.node.childNodes;
      for (var i = 0; i < childs.length; i++) {
        var span = SVG.adopt(childs[i]);
        var nextSpan = i < childs.length ? SVG.adopt(childs[i+1]) : null;
        if (span && span.data('connect-next') &&
            nextSpan && nextSpan.data('connect-prev')) {

          nextSpan.node.innerHTML = span.node.innerHTML + ' ' + nextSpan.node.innerHTML;
          span.node.remove();
          i--;
        }
      }
    },

    /**
     * Connects lines broken by word wrap method. Its required when we
     * want to changes width of textbox
     * @return {void}
     */
    connectBrokenLines: function() {
      var childs = this.node.childNodes;

      // reversed "for" loop
      for (var i = childs.length - 1; i >= 0; i--) {
        var span = SVG.adopt(childs[i]);
        if (!span || !span.data('connected-with-line')) { continue; }
        var targetSpan = SVG.get(span.data('connected-with-line'));
        if (!targetSpan) continue;

        targetSpan.node.innerHTML = span.node.innerHTML + targetSpan.node.innerHTML;
        span.node.remove();
      }
    },

    /**
     * Wraps plain text into <tspan> tags
     * @param  {SVG.Tspan} tspanLine
     * @return {void}
     */
    wrapPlainText: function(tspanLine) {
      var childs = tspanLine.node.childNodes;
      if (!childs) { return; }

      for (var i = 0; i < childs.length; i++) {
        var n = childs[i];
        if (n.nodeName !== '#text') { continue; }
        var tmp = SVG.create('tspan');
        console.log('Text wprapped: ' + n.textContent);
        tmp.innerHTML = n.textContent;
        tspanLine.node.replaceChild(tmp, n);
      }
    },

    // search recursive through all child nodes and return biggest font size in px as number
    getBiggestFont: function(line) {
      var biggestFont = parseInt(getComputedStyle(line.node)['font-size']);
      var childs = SVG.utils.filterSVGElements(line.node.childNodes);

      for (var i = childs.length - 1; i >= 0; i--) {
        var f = this.getBiggestFont(SVG.adopt(childs[i]));
        biggestFont = f > biggestFont ? f : biggestFont;
      }

      return biggestFont;
    },

    lines: function() {
      // filter tspans and map them to SVG.js instances
      var lines = SVG.utils.map(SVG.utils.filterSVGElements(this.node.childNodes), function(el){
        return SVG.adopt(el);
      });

      // return an instance of SVG.set
      return new SVG.Set(lines);
    },

    lineHeight: function(value) {
      if (value === null) return this.dom.lineHeight;
      this.dom.lineHeight = new SVG.Number(value);
      this.adjustLines();
    }
  },

  construct: {
    mtext: function() {
      return this.put(new SVG.MText());
    }
  }
});

SVG.extend(SVG.MText, {
  move: function(x, y) {
    return this.x(x).y(y);
  },

  x: function(x) {
    this.attr('x', x);
    if (this.adjustLines) { this.adjustLines(); }
    return this;
  },

  y: function(y) {
    this.attr('y', y);
    if (this.adjustLines) { this.adjustLines(); }
    return this;
  }
});

/**
 * Adopts SVG text element with multiline attr as
 * MText instance.
 * Normal <text> will not be adopted.
 *
 * @todo separate method to converts normal text to mtext
 *
 * @param {HTMLElement} node to adopt
 */
SVG.AdoptMText = function(node) {
  if (!node || node.nodeName != 'text') return null;

  // attr multiline means that <text> was mbox indeed
  if (!node.getAttribute("multiline")) return null;

  if (node.instance && node.instance instanceof SVG.MText) return node.instance;

  var element = new SVG.MText();

  element.type  = node.nodeName;
  element.node  = node;
  node.instance = element;

  console.log(element);

  element.setData(JSON.parse(node.getAttribute('svgjs:data')) || {});

  return element;
};
