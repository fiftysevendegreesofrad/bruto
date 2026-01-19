const {load_elements, } = require('./gamedata');
const fs = require('fs');
const path = require('path');

// CSV helpers
const escapeCSV = (value) => {
	if (value === null || value === undefined) return '';
	let str = String(value);
	const needsQuote = /[",\n]/.test(str);
	str = str.replace(/"/g, '""');
	return needsQuote ? `"${str}"` : str;
};

const toCSV = (headers, rows) => {
	const headerLine = headers.map(escapeCSV).join(',');
	const lines = rows.map(r => r.map(escapeCSV).join(','));
	return [headerLine, ...lines].join('\n');
};

const formatOptions = (options) => {
	// render options in one CSV cell separated by line breaks, prefixed with weights
	if (options === undefined || options === null) return '';
	try {
		let list = [];
		if (Array.isArray(options)) list = options.map(String);
		else if (typeof options === 'object') list = Object.keys(options).map(String);
		else list = [String(options)];

		const weights = list.length === 2 ? ['(+1)', '(-1)']
			: list.length === 3 ? ['(+1)', '(0)', '(-1)']
			: Array(list.length).fill('');

		return list.map((opt, i) => (weights[i] ? `${weights[i]} ${opt}` : opt)).join('\n');
	} catch {
		return '';
	}
};

// Normalization
const normalizeNode = (item) => {
	const data = item?.data ?? item;
	return {
		id: data?.id,
		// read displayLabelSingleLine instead of label
		label: data?.displayLabelSingleLine ?? data?.label ?? data?.id ?? '',
		userlabel: data?.userlabel ?? '',
		baseProb: data?.baseProb ?? data?.baseprob ?? '',
		options: data?.options
	};
};

const normalizeEdge = (item) => {
	const data = item?.data ?? item;
	return {
		source: data?.source ?? item?.source ?? '',
		target: data?.target ?? item?.target ?? '',
		weight: data?.weight ?? '',
		positiveOnly: data?.positiveOnly ?? item?.positiveOnly ?? ''
	};
};

const extractNodesAndEdges = (elements) => {
	let nodes = [];
	let edges = [];
	if (!elements) return { nodes, edges };

	if (Array.isArray(elements)) {
		for (const el of elements) {
			const group = el.group || el.data?.group;
			const data = el.data || el;
			if (group === 'edges' || (data && data.source != null && data.target != null)) {
				edges.push(normalizeEdge(el));
			} else {
				nodes.push(normalizeNode(el));
			}
		}
	} else if (elements.nodes && elements.edges) {
		const n = Array.isArray(elements.nodes) ? elements.nodes : Object.values(elements.nodes);
		const e = Array.isArray(elements.edges) ? elements.edges : Object.values(elements.edges);
		nodes = n.map(normalizeNode);
		edges = e.map(normalizeEdge);
	} else if (elements.elements) {
		return extractNodesAndEdges(elements.elements);
	} else {
		nodes = Object.values(elements).map(normalizeNode);
	}

	return { nodes, edges };
};

const to01 = (v) => {
	if (v === true || v === 1 || v === '1') return '1';
	if (typeof v === 'string') {
		const s = v.trim().toLowerCase();
		if (s === 'true' || s === 't' || s === 'yes' || s === 'y') return '1';
	}
	return '0';
};

// Main
async function main() {
	const elements = await load_elements();

	const { nodes, edges } = extractNodesAndEdges(elements);

	// Build node rows: id cell contains id + newline + label; no separate label column
	const nodeRows = nodes.map(n => [
		`${n.id ?? ''}${n.label ? '\n' + n.label : ''}`,
		n.baseProb ?? '',
		formatOptions(n.options)
	]);

	// Build edge rows with t column (1/0)
	const edgeRows = edges.map(e => [
		e.source ?? '',
		e.target ?? '',
		e.weight ?? '',
		to01(e.positiveOnly)
	]);

	const nodesCSV = toCSV(['id', 'baseProb', 'options'], nodeRows);
	const edgesCSV = toCSV(['source', 'target', 'weight', 't'], edgeRows);

	const outNodes = path.join(__dirname, 'nodes.csv');
	const outEdges = path.join(__dirname, 'edges.csv');
	fs.writeFileSync(outNodes, nodesCSV, 'utf8');
	fs.writeFileSync(outEdges, edgesCSV, 'utf8');
	console.log('Wrote:', outNodes, outEdges);
};

if (require.main === module) main();

