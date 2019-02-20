import 'patristic';

/**
 * This class function creates a TidyTree object.
 * @param {String} newick A valid newick string
 * @param {Object} options A Javascript object containing options to set up the tree
 */
export default function TidyTree(data, options, events, stylers){
  let defaults = {
		layout: 'vertical',
		type: 'tree',
    mode: 'smooth',
    leafNodes: true,
		leafLabels: false,
    leafLabelSize: 6,
    branchNodes: false,
		branchLabels: false,
    branchDistances: false,
    ruler: true,
    animation: 500,
    margin: [50, 50, 50, 50] //CSS order: top, right, bottom, left
  };
  if(!options) options = {};
  Object.assign(this, defaults, options, {events: {}, stylers: {}});

  if(!events) events = {};
  Object.assign(this.events, events);

  if(!stylers) stylers = {};
  Object.assign(this.stylers, stylers);

  if(this.parent) this.draw(this.parent);
  if(data instanceof patristic.Branch){
    this.setData(data);
  } else {
    this.setTree(data);
  }
  if(this.parent) this.recenter();
}

/**
 * Update the TidyTree's underlying data structure
 * There are two contexts in which you should call this:
 * 	1. You wish to replace the tree with a completely different tree, given by a different newick string
 * 	2. Your underlying tree data has changed (e.g. the tree has been re-rooted)
 * @param  {Object} data A patristic.Branch object
 * @return {Object}        the TidyTree object
 */
TidyTree.prototype.setData = function(data){
  if(!data) throw Error('Invalid Data');
  this.data = data;
  this.range = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
  this.hierarchy = d3.hierarchy(this.data, d => d.children)
    .eachBefore(d => {
      d.value =
        (d.parent      ? d.parent.value : 0) +
        (d.data.length ? d.data.length  : 0);
      if(d.value < this.range[0]) this.range[0] = d.value;
      if(d.value > this.range[1]) this.range[1] = d.value;
    })
    .each(d => d.value /= this.range[1]);
  if(this.parent) return this.redraw();
  return this;
};

/**
 * Update the TidyTree's underlying data structure
 * There are two contexts in which you should call this:
 * 	1. You wish to replace the tree with a completely different tree, given by a different newick string
 * 	2. Your underlying tree data has changed (e.g. the tree has been re-rooted)
 * @param  {String} newick A valid newick string
 * @return {Object}        the TidyTree object
 */
TidyTree.prototype.setTree = function(newick){
	if(!newick) throw Error("Invalid Newick String");
  return this.setData(patristic.parseNewick(newick));
};

/**
 * The available layouts for rendering trees.
 * @type {Array}
 */
TidyTree.validLayouts = ['horizontal', 'vertical', 'circular'];

/**
 * The available types for rendering branches.
 * @type {Array}
 */
TidyTree.validTypes = ['tree', 'weighted', 'dendrogram'];

/**
 * The available modes for rendering branches.
 * @type {Array}
 */
TidyTree.validModes = ['smooth', 'square', 'straight'];

/**
 * Draws a Phylogenetic on the element referred to by selector
 * @param  {String} selector A CSS selector
 * @return {TidyTree}           the TidyTree object
 */
TidyTree.prototype.draw = function(selector){
  if(!selector && !this.parent){
    throw Error('No valid target for drawing given! Where should the tree go?');
  }
  this.parent = d3.select(selector ? selector : this.parent);

	let tree = d3.tree();

	let svg = this.parent.html(null).append('svg')
	      .attr('width', '100%')
	      .attr('height', '100%');

	let g = svg.append('g');
  let rulerWrapper = svg.append('g').attr('class', 'tidytree-ruler');

	this.zoom = d3.zoom().on('zoom', () => {
    g.attr('transform', d3.event.transform);
    updateRuler.call(this, d3.event.transform);
  });
  svg.call(this.zoom);

	g.append('g').attr('class', 'tidytree-links');
  g.append('g').attr('class', 'tidytree-nodes');

  if(this.events.draw) this.events.draw();

	return this;
};

const getX      = d => d.x,
      getY      = d => d.y,
      getLength = d => d.weight;

let linkTransformers = {
  tree: {
    smooth: {
      horizontal: d3.linkHorizontal().x(getY).y(getX),
      vertical:   d3.linkVertical(  ).x(getX).y(getY),
      circular:   d3.linkRadial().angle(getX).radius(getY)
    },
    straight: {
      horizontal: d => `M${d.source.y} ${d.source.x} L ${d.target.y} ${d.target.x}`,
      vertical:   d => `M${d.source.x} ${d.source.y} L ${d.target.x} ${d.target.y}`,
      circular:   d => {
        const startAngle  = d.source.x - Math.PI/2,
              startRadius = d.source.y,
              endAngle    = d.target.x - Math.PI/2,
              endRadius   = d.target.y;
        const x0 = Math.cos(startAngle),
              y0 = Math.sin(startAngle),
              x1 = Math.cos(endAngle),
              y1 = Math.sin(endAngle);
        return  'M' + startRadius*x0 + ',' + startRadius*y0 +
                'L' +   endRadius*x1 + ',' +   endRadius*y1;
      }
    },
    square: {
      horizontal: d => `M${d.source.y} ${d.source.x} V ${d.target.x} H ${d.target.y}`,
      vertical:   d => `M${d.source.x} ${d.source.y} H ${d.target.x} V ${d.target.y}`,
      circular:   d => {
        const startAngle  = d.source.x - Math.PI/2,
              startRadius = d.source.y,
              endAngle    = d.target.x - Math.PI/2,
              endRadius   = d.target.y;
        const x0 = Math.cos(startAngle),
              y0 = Math.sin(startAngle),
              x1 = Math.cos(endAngle),
              y1 = Math.sin(endAngle);
        return  'M' + startRadius*x0 + ',' + startRadius*y0 +
                (endAngle === startAngle ? '' :
                'A' + startRadius + ',' + startRadius + ' 0 0 ' + (endAngle > startAngle ? 1 : 0) + ' ' + startRadius*x1 + ',' + startRadius*y1) +
                'L' + endRadius*x1 + ',' + endRadius * y1;
      }
    }
  },
  weighted: {
    smooth: {
      horizontal: d3.linkHorizontal().x(getLength).y(getX),
      vertical:   d3.linkVertical(  ).x(getX).y(getLength),
      circular:   d3.linkRadial().angle(getX).radius(getLength)
    },
    straight: {
      horizontal: d => `M${d.source.weight} ${d.source.x} L ${d.target.weight} ${d.target.x}`,
      vertical:   d => `M${d.source.x} ${d.source.weight} L ${d.target.x} ${d.target.weight}`,
      circular:   d => {
        const startAngle  = d.source.x - Math.PI/2,
              startRadius = d.source.weight,
              endAngle    = d.target.x - Math.PI/2,
              endRadius   = d.target.weight;
        const x0 = Math.cos(startAngle),
              y0 = Math.sin(startAngle),
              x1 = Math.cos(endAngle),
              y1 = Math.sin(endAngle);
        return  'M' + startRadius*x0 + ',' + startRadius*y0 +
                'L' +   endRadius*x1 + ',' +   endRadius*y1;
      }
    },
    square: {
      horizontal: d => `M${d.source.weight} ${d.source.x} V ${d.target.x} H ${d.target.weight}`,
      vertical:   d => `M${d.source.x} ${d.source.weight} H ${d.target.x} V ${d.target.weight}`,
      circular:   d => {
        const startAngle  = d.source.x - Math.PI/2,
              startRadius = d.source.weight,
              endAngle    = d.target.x - Math.PI/2,
              endRadius   = d.target.weight;
        const x0 = Math.cos(startAngle),
              y0 = Math.sin(startAngle),
              x1 = Math.cos(endAngle),
              y1 = Math.sin(endAngle);
        return  'M' + startRadius*x0 + ',' + startRadius*y0 +
                (endAngle === startAngle ? '' :
                'A' + startRadius + ',' + startRadius + ' 0 0 ' + (endAngle > startAngle ? 1 : 0) + ' ' + startRadius*x1 + ',' + startRadius*y1) +
                'L' + endRadius*x1 + ',' + endRadius * y1;
      }
    }
  }
};

linkTransformers.dendrogram = linkTransformers.tree;

function circularPoint(x, y){
	return [(y = +y) * Math.cos(x -= Math.PI / 2), y * Math.sin(x)];
}

let nodeTransformers = {
  tree: {
    horizontal: d => `translate(${d.y}, ${d.x})`,
    vertical:   d => `translate(${d.x}, ${d.y})`,
    circular:   d => `translate(${circularPoint(d.x, d.y)})`
  },
  weighted: {
    horizontal: d => `translate(${d.weight}, ${d.x})`,
    vertical:   d => `translate(${d.x}, ${d.weight})`,
    circular:   d => `translate(${circularPoint(d.x, d.weight)})`
  }
};

nodeTransformers.dendrogram = nodeTransformers.tree;

const radToDeg = 180 / Math.PI;

let labelTransformers = {
  tree: {
    straight: {
      horizontal: l => `translate(${(l.source.y + l.target.y)/2}, ${(l.source.x + l.target.x)/2}) rotate(${Math.atan((l.target.x-l.source.x)/(l.target.y-l.source.y))*radToDeg})`,
      vertical:   l => `translate(${(l.source.x + l.target.x)/2}, ${(l.source.y + l.target.y)/2}) rotate(${Math.atan((l.source.y-l.target.y)/(l.source.x-l.target.x))*radToDeg})`,
      circular:   l => {
        let s = circularPoint(l.source.x, l.source.y),
            t = circularPoint(l.target.x, l.target.y);
        return `translate(${(s[0]+t[0])/2}, ${(s[1]+t[1])/2}) rotate(${Math.atan((s[1]-t[1])/(s[0]-t[0]))*radToDeg})`;
      }
    },
    square: {
      horizontal: l => `translate(${(l.source.y + l.target.y)/2}, ${l.target.x})`,
      vertical:   l => `translate(${l.target.x}, ${(l.source.y + l.target.y)/2}) rotate(90)`,
      circular:   l => {
        let u = circularPoint(l.target.x, (l.source.y+l.target.y)/2);
        return `translate(${u[0]}, ${u[1]}) rotate(${l.target.x*radToDeg%180-90})`;
      }
    }
  },
  weighted: {
    straight: {
      horizontal: l => `translate(${(l.source.weight + l.target.weight)/2}, ${(l.source.x + l.target.x)/2}) rotate(${Math.atan((l.target.x-l.source.x)/(l.target.weight-l.source.weight))*radToDeg})`,
      vertical:   l => `translate(${(l.source.x + l.target.x)/2}, ${(l.source.weight + l.target.weight)/2}) rotate(${Math.atan((l.source.weight-l.target.weight)/(l.source.x-l.target.x))*radToDeg})`,
      circular:   l => {
        let s = circularPoint(l.source.x, l.source.weight),
            t = circularPoint(l.target.x, l.target.weight);
        return `translate(${(s[0]+t[0])/2}, ${(s[1]+t[1])/2}) rotate(${Math.atan((s[1]-t[1])/(s[0]-t[0]))*radToDeg})`;
      }
    },
    square: {
      horizontal: l => `translate(${(l.source.weight + l.target.weight)/2}, ${l.target.x})`,
      vertical:   l => `translate(${l.target.x}, ${(l.source.weight + l.target.weight)/2}) rotate(90)`,
      circular:   l => {
        let u = circularPoint(l.target.x, (l.source.weight+l.target.weight)/2);
        return `translate(${u[0]}, ${u[1]}) rotate(${l.target.x*radToDeg%180-90})`;
      }
    }
  }
};
labelTransformers.tree.smooth = labelTransformers.tree.straight;
labelTransformers.weighted.smooth = labelTransformers.weighted.straight;
labelTransformers.dendrogram = labelTransformers.tree;

/**
 * Redraws the links and relocates the nodes accordingly
 * @return {TidyTree} The TidyTree Object
 */
TidyTree.prototype.redraw = function(){
  let parent = this.parent;

  this.width  = parseFloat(parent.style('width'))  - this.margin[0] - this.margin[2];
  this.height = parseFloat(parent.style('height')) - this.margin[1] - this.margin[3];

  this.scalar = (this.layout === 'horizontal' ? this.width : (this.layout === 'vertical' ? this.height : Math.min(this.width, this.height)/2));
  this.hierarchy.each(d => d.weight = this.scalar * d.value);

	let g = parent.select('svg g');

	let source = (this.type === 'tree' ? d3.tree() : d3.cluster())
    .size(this.layout === 'circular' ? [2 * Math.PI, Math.min(this.height, this.width)/2] : this.layout === 'horizontal' ? [this.height, this.width] : [this.width, this.height])
    .separation((a, b) => 1);

  //Note: You must render links prior to nodes in order to get correct placement!
  let links = g.select('g.tidytree-links').selectAll('g.tidytree-link').data(source(this.hierarchy).links());
  links.join(
    enter => {
      let newLinks = enter.append('g').attr('class', 'tidytree-link');

      newLinks.append('path')
        .attr('fill', 'none')
			  .attr('stroke', '#ccc')
        .attr('d', linkTransformers[this.type][this.mode][this.layout])
        .transition().duration(this.animation)
        .attr('opacity', 1);

      newLinks.append('text')
        .attr('y', 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '6px')
        .text(d => {
          if(typeof d.target.data.length === 'undefined') return '0.000';
          return(d.target.data.length.toLocaleString());
        })
        .transition().duration(this.animation)
        .style('opacity', this.branchDistances ? 1 : 0);
    },
    update => {
      update.select('path')
        .transition().duration(this.animation)
        .attr('d', linkTransformers[this.type][this.mode][this.layout]);

      update.select('text')
        .transition().duration(this.animation)
        .attr('transform', labelTransformers[this.type][this.mode][this.layout]);
    },
    exit => exit.transition().duration(this.animation).attr('opacity', 0).remove()
  );

	let nodes = g.select('g.tidytree-nodes').selectAll('g.tidytree-node').data(this.hierarchy.descendants(), d => d.data.id);
  nodes.join(
    enter => {
      let newNodes = enter.append('g')
        .attr('class', d => 'tidytree-node ' + (d.children ? 'tidytree-node-internal' : 'tidytree-node-leaf'));

      newNodes.append('circle')
        .attr('title', d => d.data.id)
        .style('opacity', d => (d.children && this.branchNodes) || (!d.children && this.leafNodes) ? 1 : 0)
        .on('mouseenter focusin', d => this.trigger('showtooltip', d))
        .on('mouseout focusout', d => this.trigger('hidetooltip', d))
        .on('contextmenu', d => this.trigger('contextmenu', d))
        .attr('r', 2.5);

      let nodeLabels = newNodes.append('text')
        .text(d => d.data.id)
        .style('font-size', '6px')
        .attr('y', 2)
        .style('opacity', d => (d.children && this.branchLabels) || (!d.children && this.leafLabels) ? 1 : 0);

      if(this.layout === 'vertical'){
        nodeLabels.attr('transform', 'rotate(90)').attr('text-anchor', 'start').attr('x', 5);
      } else if(this.layout === 'horizontal'){
        nodeLabels.attr('transform', 'rotate(0)').attr('text-anchor', 'start').attr('x', 5);
      } else {
        nodeLabels
          .attr('transform', l => 'rotate('+(l.x / Math.PI * 180 % 180 - 90)+')')
          .attr('text-anchor', l => l.x % (2*Math.PI) > Math.PI ? 'end' : 'start')
          .attr('x', l => l.x % (2*Math.PI) > Math.PI ? -5 : 5);
      }

      newNodes
        .transition().duration(this.animation)
        .attr('transform', nodeTransformers[this.type][this.layout]);
    },
    update => {
      update
        .transition().duration(this.animation)
        .attr('transform', nodeTransformers[this.type][this.layout]);

      let nodeLabels = update.select('text');
      if(this.layout === 'vertical'){
        nodeLabels.attr('transform', 'rotate(90)').attr('text-anchor', 'start').attr('x', 5);
      } else if(this.layout === 'horizontal'){
        nodeLabels.attr('transform', 'rotate(0)').attr('text-anchor', 'start').attr('x', 5);
      } else {
        nodeLabels
          .attr('transform', l => 'rotate('+(l.x / Math.PI * 180 % 180 - 90)+')')
          .attr('text-anchor', l => l.x % (2*Math.PI) > Math.PI ? 'end' : 'start')
          .attr('x', l => l.x % (2*Math.PI) > Math.PI ? -5 : 5);
      }
    },
    exit => exit.transition().duration(this.animation).attr('opacity', 0).remove()
  );

  updateRuler.call(this);

	return this;
};

function updateRuler(transform){
  if(!transform) transform = {k: 1};
  let ruler = this.parent.select('g.tidytree-ruler');
  if(this.ruler){
    ruler.attr('transform', this.layout == 'horizontal' ? `translate(${this.margin[3]},${this.height+this.margin[0]})` : `translate(${this.margin[0]},${this.margin[3]})`);
    let axis = this.layout == 'horizontal' ? d3.axisTop() : d3.axisLeft();
    if(this.type === 'tree' && this.layout !== 'circular'){
      ruler
        .attr('opacity', 1)
        .call(axis.scale(d3.scaleLinear([0, this.hierarchy.height/transform.k], [0, this.scalar])));
    } else if(this.type === 'weighted' && this.layout !== 'circular'){
      ruler
        .attr('opacity', 1)
        .call(axis.scale(d3.scaleLinear([this.range[0], this.range[1]/transform.k], [0, this.scalar])));
    } else {
      ruler.attr('opacity', 0);
    }
  } else {
    ruler.attr('opacity', 0);
  }
}

/**
 * Recenters the tree in the center of the view
 * @return {TidyTree} The TidyTree object
 */
TidyTree.prototype.recenter = function(){
  let svg = this.parent.select('svg'),
      x = this.margin[0],
      y = this.margin[3];
  if(this.layout === 'circular'){
    x += parseFloat(svg.style('width' ))/2;
    y += parseFloat(svg.style('height'))/2;
  }
  svg
    .transition().duration(this.animation)
    .call(this.zoom.transform, d3.zoomIdentity.translate(x, y));
  return this;
};

/**
 * Set the TidyTree's layout
 * @param {String} newLayout The new layout
 * @return {TidyTree} The TidyTree Object
 */
TidyTree.prototype.setLayout = function(newLayout){
  if(!TidyTree.validLayouts.includes(newLayout)){
		throw Error('Cannot set TidyTree to layout:', newLayout, '\nValid layouts are:', TidyTree.validLayouts);
	}
	this.layout = newLayout;
  if(this.parent) return this.redraw();
  return this;
};

/**
 * Set the TidyTree's mode
 * @param {String} newMode The new mode
 * @return {TidyTree} The TidyTree object
 */
TidyTree.prototype.setMode = function(newMode){
  if(!TidyTree.validModes.includes(newMode)){
		throw Error('Cannot set TidyTree to mode:', newMode, '\nValid modes are:', TidyTree.validModes);
  }
	this.mode = newMode;
  if(this.parent) return this.redraw();
  return this;
};

/**
 * Set the TidyTree's type
 * @param {Boolean} newType The new type
 * @return {TidyTree} the TidyTree object
 */
TidyTree.prototype.setType = function(newType){
  if(!TidyTree.validTypes.includes(newType)){
		throw Error('Cannot set TidyTree to type:', newType, '\nValid types are:', TidyTree.validTypes);
	}
	this.type = newType;
  if(this.parent) return this.redraw();
  return this;
};

/**
 * Set the TidyTree's animation speed. Note that this does not trigger a
 * redraw.
 * @param {number} speed The desired duration of an animation, in ms. Set to 0
 * to turn animations off completely.
 * @return {TidyTree} The TidyTree object
 */
TidyTree.prototype.setAnimation = function(speed){
	this.animation = speed;
  return this;
};

/**
 * Shows or hides the Branch Nodes
 * @param  {Boolean} show Should Branch nodes be shown?
 * @return {TidyTree} the TidyTree object
 */
TidyTree.prototype.setBranchNodes = function(show){
  this.branchNodes = show ? true : false;
  if(this.parent){ //i.e. has already been drawn
    this.parent.select('svg').selectAll('g.tidytree-node-internal circle')
      .transition().duration(this.animation)
      .style('opacity', show ? 1 : 0);
  }
  return this;
};

/**
 * Restyles Leaf Nodes
 * @param  {Function} styler A function that restyles each node. `styler`
 * receives a reference to the DOM node to be styled, and an associated data
 * object.
 * @return {TidyTree} the TidyTree Object
 */
TidyTree.prototype.eachBranchNode = function(styler){
  this.stylers.branchNodes = styler;
  if(!this.parent) throw Error('Tree has not been rendered yet! Can\'t style Nodes that don\'t exist!');
  this.parent.select('svg').selectAll('g.tidytree-node-internal circle').each(function(d){ styler(this, d); });
  return this;
};

/**
 * Set the TidyTree's branchLabels
 * @param  {Boolean} show Should the TidyTree show branchLabels?
 * @return {TidyTree}     the TidyTree Object
 */
TidyTree.prototype.setBranchLabels = function(show){
  this.branchLabels = show ? true : false;
  if(this.parent){ //i.e. has already been drawn
    this.parent.select('svg').selectAll('g.tidytree-node-internal text')
      .transition().duration(this.animation)
      .style('opacity', show ? 1 : 0);
  }
  return this;
};

/**
 * Restyles Branch Label
 * @param  {Function} styler A function that restyles each node. `styler`
 * receives a reference to the DOM node to be styled, and an associated data
 * object.
 * @return {TidyTree} the TidyTree Object
 */
TidyTree.prototype.eachBranchLabel = function(styler){
  this.stylers.branchLabels = styler;
  if(!this.parent) throw Error('Tree has not been rendered yet! Can\'t style Nodes that don\'t exist!');
  this.parent.select('svg').selectAll('g.tidytree-node-internal text').each(function(d, i, l){ styler(this, d); });
  return this;
};

/**
 * Sets the size of the Branch Labels
 * @param {Number} size The desired size (in font-pixels). Note that this is
 * not necessarily the actual on-screen size, as labels scale with zooming.
 * @return {TidyTree} The TidyTree Object
 */
TidyTree.prototype.setBranchLabelSize = function(size){
  this.branchLabelSize = size;
  if(this.parent){ //i.e. has already been drawn
    this.parent.select('svg').selectAll('g.tidytree-node-internal text')
      .transition().duration(this.animation)
      .attr(this.layout === 'horizontal' ? 'y' : 'x', size/2.5)
      .style('font-size', size+'px');
  }
  return this;
};

/**
 * Shows or hides the TidyTree's branch labels
 * @param {Boolean} show Should the TidyTree show branchLabels?
 * @return {TidyTree} The TidyTree Object
 */
TidyTree.prototype.setBranchDistances = function(show){
  this.branchDistances = show ? true : false;
  if(this.parent){ //i.e. has already been drawn
    let links = this.parent.select('svg g.tidytree-links').selectAll('g.tidytree-link').selectAll('text');
    if(show) links.attr('transform', labelTransformers[this.type][this.mode][this.layout]);
    links
      .transition().duration(this.animation)
      .style('opacity', show ? 1 : 0);
  }
  return this;
};

/**
 * Restyles Branch Distances
 * @param  {Function} styler A function that restyles each node. `styler`
 * receives a reference to the DOM node to be styled, and an associated data
 * object.
 * @return {TidyTree} the TidyTree Object
 */
TidyTree.prototype.eachBranchDistance = function(styler){
  this.stylers.branchDistances = styler;
  if(!this.parent) throw Error('Tree has not been rendered yet! Can\'t style Nodes that don\'t exist!');
  this.parent.select('svg g.tidytree-links').selectAll('g.tidytree-link').selectAll('text').each(function(d, i, l){ styler(this, d); });
  return this;
};

/**
 * Set the TidyTree's Branch Distance Sizes
 * @param {Boolean} size The desired size (in font-pixels) of the branch
 * distances
 * @return {TidyTree} The TidyTree Object
 */
TidyTree.prototype.setBranchDistanceSize = function(size){
  this.branchDistanceSize = size;
  if(this.parent){ //i.e. has already been drawn
    this.parent.select('svg g.tidytree-links').selectAll('g.tidytree-link').selectAll('text')
      .transition().duration(this.animation)
      .style('font-size', size + 'px');
  }
  return this;
};

/**
 * Shows or Hides the Leaf Nodes
 * @param  {Boolean} show Should leaf nodes be visible?
 * @return {TidyTree} The TidyTree Object
 */
TidyTree.prototype.setLeafNodes = function(show){
  this.leafNodes = show ? true : false;
  if(this.parent){ //i.e. has already been drawn
    this.parent.select('svg').selectAll('g.tidytree-node-leaf circle')
      .transition().duration(this.animation)
      .style('opacity', show ? 1 : 0);
  }
  return this;
};

/**
 * Restyles Leaf Nodes
 * @param  {Function} styler A function that restyles each node. `styler`
 * receives a reference to the DOM node to be styled, and an associated data
 * object.
 * @return {TidyTree} the TidyTree Object
 */
TidyTree.prototype.eachLeafNode = function(styler){
  this.stylers.leafNodes = styler;
  if(!this.parent) throw Error('Tree has not been rendered yet! Can\'t style Nodes that don\'t exist!');
  this.parent.select('svg').selectAll('g.tidytree-node-leaf circle').each(function(d){ styler(this, d); });
  return this;
};

/**
 * Shows or Hides the TidyTree's Leaf Labels
 * @param  {Boolean} show Should the TidyTree show leafLabels?
 * @return {TidyTree}     the TidyTree Object
 */
TidyTree.prototype.setLeafLabels = function(show){
  this.leafLabels = show ? true : false;
  if(this.parent){ //i.e. has already been drawn
    this.parent.select('svg').selectAll('g.tidytree-node-leaf text')
      .transition().duration(this.animation)
      .style('opacity', show ? 1 : 0);
  }
  return this;
};

/**
 * Restyles Leaf Labels
 * @param  {Function} styler A function that restyles each node. `styler`
 * receives a reference to the DOM node to be styled, and an associated data
 * object.
 * @return {TidyTree} the TidyTree Object
 */
TidyTree.prototype.eachLeafLabel = function(styler){
  this.stylers.leafLabels = styler;
  if(!this.parent) throw Error('Tree has not been rendered yet! Can\'t style Nodes that don\'t exist!');
  this.parent.select('svg').selectAll('g.tidytree-node-leaf text').each(function(d){ styler(this, d); });
  return this;
};

/**
 * Sets the size of Leaf Labels
 * @param  {Number} size The desired size (in font pixels) of the leaf labels.
 * Note that this is not necessarily the actual on-screen size, as labels
 * scale with zooming over the tree.
 * @return {TidyTree} the TidyTree Object
 */
TidyTree.prototype.setLeafLabelSize = function(size){
  this.leafLabelSize = size;
  if(this.parent){ //i.e. has already been drawn
    this.parent.select('svg').selectAll('g.tidytree-node-leaf text')
      .transition().duration(this.animation)
      .attr(this.layout === 'horizontal' ? 'y' : 'x', size/2.5)
      .style('font-size', size+'px');
  }
  return this;
};

/**
 * Shows or hides the TidyTree's branch labels
 * @param {Boolean} show Should the TidyTree show branchLabels?
 * @return {TidyTree} The TidyTree Object
 */
TidyTree.prototype.setRuler = function(show){
  this.ruler = show ? true : false;
  if(this.parent){ //i.e. has already been drawn
    this.redraw();
  }
  return this;
};

/**
 * Attaches a new event listener
 * Please note that this is not yet functioning.
 * @param  {String}   events   A space-delimited list of event names
 * @param  {Function} callback The function to run when one of the `events` occurs.
 * @return {TidyTree} The TidyTree on which this method was called.
 */
TidyTree.prototype.on = function(events, callback){
  events.split(' ').forEach(event => this.events[event] = callback);
  return this;
};

/**
 * Removes event listeners
 * @param  {String}   events   A space-delimited list of event names
 * @return {TidyTree} The TidyTree on which this method was called.
 */
TidyTree.prototype.off = function(events){
  let nullFn = () => null;
  events.split(' ').forEach(event => this.events[event] = nullFn);
  return this;
};

/**
 * Forces the tree to respond as though an `event` has occurred
 * Please note that this is not yet functioning.
 * @param  {String} event The name of an event.
 * @param  {Spread} args  Any arguments which should be passed to the event.
 * @return The output of the callback run on `event`
 */
TidyTree.prototype.trigger = function(event, ...args){
  if(!this.events[event]) throw Error(`No event named ${event} is defined.`);
  return this.events[event](args);
};

/**
 * Destroys the TidyTree
 * @return {undefined}
 */
TidyTree.prototype.destroy = function(){
  if(this.parent){ //i.e. has already been drawn
    this.parent.html(null);
  }
  delete this; //Go to work, GC!
};
