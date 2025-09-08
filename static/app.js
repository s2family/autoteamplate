// Enhanced Visual Workflow Editor v2.0 - Complete Implementation
class VisualWorkflowEditor {
    constructor(mode = 'create') {
        this.mode = mode;
        this.nodes = new Map();
        this.connections = new Map();
        this.selectedNode = null;
        this.isDragging = false;
        this.isConnecting = false;
        this.isPanning = false;
        this.connectionSource = null;
        this.tempConnection = null;
        this.nodeCounter = 0;
        this.startNodeId = null;
        this.clickCount = 0;
        this.lastClickedConnection = null;
        
        // Zoom & Pan properties
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.minZoom = 0.1;
        this.maxZoom = 3;
        
        // Tab management for new navigation nodes
        this.tabVariables = new Map();
        this.currentTabVariable = 'main_tab';
        
        // Mode-specific element IDs
        this.elementIds = this.getElementIds(mode);
        
        this.init();
    }

    getElementIds(mode) {
        if (mode === 'edit') {
            return {
                canvas: 'editWorkflowCanvas',
                canvasContainer: 'editCanvasContainer',
                svg: 'editConnectionSvg',
                properties: 'editPropertiesContent',
                nodeCount: 'editNodeCount',
                connectionCount: 'editConnectionCount',
                workflowData: 'editWorkflowData'
            };
        } else {
            return {
                canvas: 'workflowCanvas',
                canvasContainer: 'canvasContainer',
                svg: 'connectionSvg',
                properties: 'propertiesContent',
                nodeCount: 'nodeCount',
                connectionCount: 'connectionCount',
                workflowData: 'workflowData'
            };
        }
    }

    init() {
        this.canvas = document.getElementById(this.elementIds.canvas);
        this.canvasContainer = document.getElementById(this.elementIds.canvasContainer);
        this.svg = document.getElementById(this.elementIds.svg);
        this.propertiesPanel = document.getElementById(this.elementIds.properties);
        
        if (!this.canvas || !this.canvasContainer || !this.svg || !this.propertiesPanel) {
            console.error('VisualWorkflowEditor: Required elements not found for mode:', this.mode);
            return;
        }
        
        this.setupEventListeners();
        this.setupPalette();
        this.setupZoomControls();
        this.updateCounts();
        
        if (this.mode === 'create') {
            this.createStartNode();
        }
        
        this.updateWorkflowData();
    }

    // Event Listeners Setup
    setupEventListeners() {
        if (!this.canvas) return;
        
        // Canvas events
        this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));
        this.canvas.addEventListener('drop', (e) => this.onCanvasDrop(e));
        this.canvas.addEventListener('dragover', (e) => e.preventDefault());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('mousedown', (e) => this.onCanvasMouseDown(e));

        // Global events
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('keydown', (e) => this.onKeyDown(e));

        // Mode-specific toolbar events
        if (this.mode === 'create') {
            this.setupCreateModeEvents();
        } else if (this.mode === 'edit') {
            this.setupEditModeEvents();
        }
    }

    setupCreateModeEvents() {
        const clearBtn = document.getElementById('clearWorkflow');
        const validateBtn = document.getElementById('validateWorkflow');
        const exportBtn = document.getElementById('exportWorkflow');
        const importBtn = document.getElementById('importWorkflow');
        const form = document.getElementById('workflowForm');

        if (clearBtn) clearBtn.addEventListener('click', () => this.clearWorkflow());
        if (validateBtn) validateBtn.addEventListener('click', () => this.validateWorkflow());
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportWorkflow());
        if (importBtn) importBtn.addEventListener('click', () => {
            const modal = document.getElementById('importWorkflowModal');
            if (modal) modal.style.display = 'block';
        });
        if (form) form.addEventListener('submit', (e) => this.onFormSubmit(e));
    }

    setupEditModeEvents() {
        const clearBtn = document.getElementById('clearEditWorkflow');
        const validateBtn = document.getElementById('validateEditWorkflow');
        const exportBtn = document.getElementById('exportEditWorkflow');
        const autoLayoutBtn = document.getElementById('autoLayoutEdit');

        if (clearBtn) clearBtn.addEventListener('click', () => this.clearWorkflow());
        if (validateBtn) validateBtn.addEventListener('click', () => this.validateWorkflow());
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportWorkflow());
        if (autoLayoutBtn) autoLayoutBtn.addEventListener('click', () => this.autoLayout());
    }

    setupPalette() {
        document.querySelectorAll('.palette-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('nodeType', item.dataset.nodeType);
            });
        });
    }

    setupZoomControls() {
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        const zoomResetBtn = document.getElementById('zoomReset');

        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());
        if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => this.resetZoom());
        
        this.updateZoomLevel();
    }

    // Zoom & Pan Methods
    onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + delta));
        
        if (newZoom !== this.zoom) {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            this.zoomAt(mouseX, mouseY, newZoom);
        }
    }

    zoomAt(x, y, newZoom) {
        const oldZoom = this.zoom;
        this.zoom = newZoom;
        
        // Adjust pan to zoom at mouse position
        this.panX = x - (x - this.panX) * (newZoom / oldZoom);
        this.panY = y - (y - this.panY) * (newZoom / oldZoom);
        
        this.updateTransform();
        this.updateZoomLevel();
    }

    zoomIn() { this.setZoom(Math.min(this.maxZoom, this.zoom + 0.2)); }
    zoomOut() { this.setZoom(Math.max(this.minZoom, this.zoom - 0.2)); }
    
    setZoom(newZoom) {
        this.zoom = newZoom;
        this.updateTransform();
        this.updateZoomLevel();
    }

    resetZoom() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateTransform();
        this.updateZoomLevel();
    }

    updateTransform() {
        if (this.canvasContainer) {
            this.canvasContainer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
            this.updateAllConnections();
        }
    }

    updateZoomLevel() {
        const zoomElement = document.getElementById('zoomLevel');
        if (zoomElement) {
            zoomElement.textContent = `${Math.round(this.zoom * 100)}%`;
        }
    }

    // Canvas Pan Methods
    onCanvasMouseDown(e) {
        if (e.target === this.canvas || e.target === this.canvasContainer) {
            this.isPanning = true;
            this.panStartX = e.clientX - this.panX;
            this.panStartY = e.clientY - this.panY;
            this.canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    }

    onMouseMove(e) {
        if (this.isPanning) {
            this.panX = e.clientX - this.panStartX;
            this.panY = e.clientY - this.panStartY;
            this.updateTransform();
        } else if (this.isDragging && this.dragNodeId) {
            this.handleNodeDrag(e);
        } else if (this.isConnecting && this.tempConnection) {
            this.updateTempConnection(this.getConnectionScreenPos(this.connectionSource.element), { x: e.clientX, y: e.clientY });
        }
    }

    onMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'grab';
        }
        
        if (this.isConnecting) {
            this.handleConnectionEnd(e);
        }
        
        this.isDragging = false;
        this.dragNodeId = null;
    }

    // Node Management
    createStartNode() {
        const startNodeId = this.createNode('start', 100, 100);
        this.startNodeId = startNodeId;
        const startNode = this.nodes.get(startNodeId);
        if (startNode) {
            startNode.element.classList.add('start-node');
            const inputPoint = startNode.element.querySelector('.node-input');
            if (inputPoint) inputPoint.style.display = 'none';
        }
    }

    createNode(type, x, y) {
        const nodeId = `node_${++this.nodeCounter}`;
        const config = this.getNodeConfig(type);
        
        const nodeElement = document.createElement('div');
        nodeElement.className = `workflow-node type-${this.getNodeCategory(type)}`;
        nodeElement.id = nodeId;
        nodeElement.style.left = `${x}px`;
        nodeElement.style.top = `${y}px`;
        
        nodeElement.innerHTML = `
            <div class="node-header">
                <i class="${config.icon}"></i>
                <span>${config.title}</span>
            </div>
            <div class="node-content">${config.description}</div>
            ${type !== 'start' ? '<div class="node-input node-connection" data-type="input"></div>' : ''}
            <div class="node-output-success node-connection" data-type="success" data-node="${nodeId}"></div>
            <div class="node-output-error node-connection" data-type="error" data-node="${nodeId}"></div>
        `;

        this.setupNodeEvents(nodeElement, nodeId);
        this.canvasContainer.appendChild(nodeElement);
        
        this.nodes.set(nodeId, {
            id: nodeId,
            type: type,
            position: { x, y },
            data: { ...config.defaultData },
            element: nodeElement
        });

        this.updateCounts();
        this.selectNode(nodeId);
        this.updateWorkflowData();
        
        return nodeId;
    }

    getNodeCategory(type) {
        const categories = {
            'open_browser': 'basic', 'wait': 'basic', 'wait_element': 'basic',
            'new_tab': 'navigation', 'activate_tab': 'navigation', 'open_url': 'navigation',
            'close_tab': 'navigation', 'go_back': 'navigation', 'reload_page': 'navigation',
            'click': 'interaction', 'type_text': 'interaction', 'scroll': 'interaction',
            'press_key': 'keyboard',
            'element_exists': 'data', 'get_text': 'data',
            'condition': 'control', 'loop': 'control', 'javascript': 'control',
            'upload': 'file', 'download': 'file', 'screenshot': 'file'
        };
        return categories[type] || 'basic';
    }

    setupNodeEvents(nodeElement, nodeId) {
        nodeElement.addEventListener('mousedown', (e) => this.onNodeMouseDown(e, nodeId));
        nodeElement.addEventListener('click', (e) => this.onNodeClick(e, nodeId));
        
        nodeElement.querySelectorAll('.node-connection').forEach(conn => {
            conn.addEventListener('mouseenter', () => this.onConnectionHover(conn, true));
            conn.addEventListener('mouseleave', () => this.onConnectionHover(conn, false));
            conn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (conn.dataset.type !== 'input') {
                    this.startConnection(e, nodeId, conn.dataset.type, conn);
                }
            });
        });
    }

    onNodeMouseDown(e, nodeId) {
        if (e.button === 0) {
            this.isDragging = true;
            this.dragNodeId = nodeId;
            const node = this.nodes.get(nodeId);
            this.dragStart = {
                x: e.clientX,
                y: e.clientY,
                nodeX: node.position.x,
                nodeY: node.position.y
            };
            e.preventDefault();
        }
    }

    handleNodeDrag(e) {
        const dx = (e.clientX - this.dragStart.x) / this.zoom;
        const dy = (e.clientY - this.dragStart.y) / this.zoom;
        
        const newX = Math.max(0, this.dragStart.nodeX + dx);
        const newY = Math.max(0, this.dragStart.nodeY + dy);
        
        const node = this.nodes.get(this.dragNodeId);
        node.position.x = newX;
        node.position.y = newY;
        node.element.style.left = `${newX}px`;
        node.element.style.top = `${newY}px`;
        
        this.updateAllConnections();
    }

    deleteNode(nodeId) {
        if (nodeId === this.startNodeId) {
            alert('Cannot delete start node');
            return;
        }

        const node = this.nodes.get(nodeId);
        if (node && confirm(`Delete ${node.type} node?`)) {
            // Remove connections
            [...this.connections.keys()].forEach(connId => {
                const conn = this.connections.get(connId);
                if (conn.source === nodeId || conn.target === nodeId) {
                    this.deleteConnection(connId);
                }
            });

            node.element.remove();
            this.nodes.delete(nodeId);
            
            if (this.selectedNode === nodeId) {
                this.selectedNode = null;
                this.clearProperties();
            }
            
            this.updateCounts();
            this.updateWorkflowData();
        }
    }

    // Connection Management
    startConnection(e, nodeId, connectionType, element) {
        this.isConnecting = true;
        this.connectionSource = { nodeId, type: connectionType, element };
        
        this.createTempConnection(e);
        element.classList.add('connecting');
        document.body.style.cursor = 'crosshair';
    }

    createTempConnection(e) {
        const sourcePos = this.getConnectionScreenPos(this.connectionSource.element);
        
        this.tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempConnection.classList.add('connection-line', `connection-${this.connectionSource.type}`, 'temp-connection');
        this.tempConnection.style.pointerEvents = 'none';
        
        this.svg.appendChild(this.tempConnection);
        this.updateTempConnection(sourcePos, { x: e.clientX, y: e.clientY });
    }

    updateTempConnection(start, end) {
        if (!this.tempConnection) return;

        const canvasRect = this.canvas.getBoundingClientRect();
        const adjustedEnd = {
            x: (end.x - canvasRect.left - this.panX) / this.zoom,
            y: (end.y - canvasRect.top - this.panY) / this.zoom
        };

        const path = this.createBezierPath(start, adjustedEnd);
        this.tempConnection.setAttribute('d', path);
    }

    handleConnectionEnd(e) {
        const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
        let targetConnection = null;
        let targetNodeId = null;

        for (let element of elementsAtPoint) {
            if (element.classList.contains('node-connection') && element.dataset.type === 'input') {
                targetConnection = element;
                targetNodeId = this.getNodeIdFromElement(element);
                break;
            }
        }

        if (targetConnection && targetNodeId && targetNodeId !== this.connectionSource.nodeId) {
            this.createConnection(this.connectionSource.nodeId, targetNodeId, this.connectionSource.type);
        }
        
        this.cleanupConnection();
    }

    createConnection(sourceId, targetId, type = 'success') {
        if (sourceId === targetId) return false;

        const connId = `${sourceId}_${targetId}_${type}`;
        if (this.connections.has(connId)) return false;

        if (this.wouldCreateCycle(sourceId, targetId)) {
            alert('Cannot create connection: This would create a cycle in the workflow');
            return false;
        }

        const sourceNode = this.nodes.get(sourceId);
        const targetNode = this.nodes.get(targetId);
        if (!sourceNode || !targetNode) return false;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('connection-line', `connection-${type}`);
        path.setAttribute('data-connection', connId);
        path.setAttribute('marker-end', `url(#${this.mode === 'edit' ? 'editArrow' : 'arrow'}${type === 'success' ? 'Success' : 'Error'})`);
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.textContent = type === 'success' ? '✓' : '✗';
        label.classList.add('connection-label', `label-${type}`);
        
        this.svg.appendChild(path);
        this.svg.appendChild(label);
        
        this.connections.set(connId, {
            id: connId,
            source: sourceId,
            target: targetId,
            type: type,
            element: path,
            label: label
        });

        // Double-click to delete connection
        path.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleConnectionClick(connId);
        });

        this.updateConnection(connId);
        this.updateCounts();
        this.updateWorkflowData();
        
        return true;
    }

    handleConnectionClick(connId) {
        if (this.lastClickedConnection === connId) {
            this.clickCount++;
            if (this.clickCount === 2) {
                this.deleteConnection(connId);
                this.clickCount = 0;
                this.lastClickedConnection = null;
                return;
            }
        } else {
            this.clickCount = 1;
            this.lastClickedConnection = connId;
        }

        setTimeout(() => {
            this.clickCount = 0;
            this.lastClickedConnection = null;
        }, 400);
    }

    deleteConnection(connId) {
        const conn = this.connections.get(connId);
        if (conn) {
            conn.element.remove();
            if (conn.label) conn.label.remove();
            this.connections.delete(connId);
            this.updateCounts();
            this.updateWorkflowData();
        }
    }

    // Helper Methods
    onConnectionHover(connectionElement, isHovering) {
        if (this.isConnecting && connectionElement.dataset.type === 'input') {
            const targetNodeId = this.getNodeIdFromElement(connectionElement);
            if (targetNodeId !== this.connectionSource.nodeId) {
                connectionElement.classList.toggle('connection-target', isHovering);
            }
        }
    }

    cleanupConnection() {
        this.isConnecting = false;
        if (this.tempConnection) {
            this.tempConnection.remove();
            this.tempConnection = null;
        }
        
        if (this.connectionSource && this.connectionSource.element) {
            this.connectionSource.element.classList.remove('connecting');
        }
        
        this.connectionSource = null;
        document.body.style.cursor = 'default';
        
        document.querySelectorAll('.connection-target').forEach(el => {
            el.classList.remove('connection-target');
        });
    }

    wouldCreateCycle(sourceId, targetId) {
        const visited = new Set();
        const stack = [targetId];
        
        while (stack.length > 0) {
            const currentId = stack.pop();
            if (currentId === sourceId) return true;
            if (visited.has(currentId)) continue;
            
            visited.add(currentId);
            
            this.connections.forEach(conn => {
                if (conn.source === currentId) {
                    stack.push(conn.target);
                }
            });
        }
        
        return false;
    }

    getConnectionScreenPos(connectionElement) {
        const rect = connectionElement.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        return {
            x: (rect.left + rect.width / 2 - canvasRect.left - this.panX) / this.zoom,
            y: (rect.top + rect.height / 2 - canvasRect.top - this.panY) / this.zoom
        };
    }

    getNodeConnectionPoint(node, type) {
        const rect = node.element.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        const baseX = (rect.left - canvasRect.left - this.panX) / this.zoom;
        const baseY = (rect.top - canvasRect.top - this.panY) / this.zoom;
        const width = rect.width / this.zoom;
        const height = rect.height / this.zoom;
        
        switch (type) {
            case 'input': return { x: baseX, y: baseY + height / 2 };
            case 'success': return { x: baseX + width, y: baseY + height * 0.3 };
            case 'error': return { x: baseX + width, y: baseY + height * 0.7 };
            default: return { x: baseX + width / 2, y: baseY + height / 2 };
        }
    }

    createBezierPath(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const curvature = Math.min(distance * 0.3, 100);
        
        const cp1x = start.x + curvature;
        const cp2x = end.x - curvature;
        
        return `M ${start.x} ${start.y} C ${cp1x} ${start.y}, ${cp2x} ${end.y}, ${end.x} ${end.y}`;
    }

    updateConnection(connId) {
        const conn = this.connections.get(connId);
        if (!conn) return;

        const sourceNode = this.nodes.get(conn.source);
        const targetNode = this.nodes.get(conn.target);
        if (!sourceNode || !targetNode) return;

        const sourcePos = this.getNodeConnectionPoint(sourceNode, conn.type);
        const targetPos = this.getNodeConnectionPoint(targetNode, 'input');

        const path = this.createBezierPath(sourcePos, targetPos);
        conn.element.setAttribute('d', path);

        if (conn.label) {
            const midX = (sourcePos.x + targetPos.x) / 2;
            const midY = (sourcePos.y + targetPos.y) / 2 - 5;
            conn.label.setAttribute('x', midX);
            conn.label.setAttribute('y', midY);
        }
    }

    updateAllConnections() {
        this.connections.forEach((conn, connId) => {
            this.updateConnection(connId);
        });
    }

    getNodeIdFromElement(element) {
        let current = element;
        while (current && current !== this.canvasContainer) {
            if (current.classList && current.classList.contains('workflow-node')) {
                return current.id;
            }
            current = current.parentElement;
        }
        return null;
    }

    // UI Methods
    onCanvasClick(e) {
        if (e.target === this.canvas || e.target === this.canvasContainer || e.target === this.svg) {
            this.clearSelection();
        }
    }

    onNodeClick(e, nodeId) {
        e.stopPropagation();
        this.selectNode(nodeId);
    }

    onCanvasDrop(e) {
        e.preventDefault();
        const nodeType = e.dataTransfer.getData('nodeType');
        if (nodeType) {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - this.panX) / this.zoom - 75;
            const y = (e.clientY - rect.top - this.panY) / this.zoom - 25;
            this.createNode(nodeType, Math.max(0, x), Math.max(0, y));
        }
    }

    onKeyDown(e) {
        if (e.key === 'Delete' && this.selectedNode && this.selectedNode !== this.startNodeId) {
            this.deleteNode(this.selectedNode);
        } else if (e.key === 'Escape') {
            if (this.isConnecting) {
                this.cleanupConnection();
            }
        }
    }

    selectNode(nodeId) {
        this.clearSelection();
        this.selectedNode = nodeId;
        const node = this.nodes.get(nodeId);
        if (node) {
            node.element.classList.add('selected');
            this.showNodeProperties(nodeId);
        }
    }

    clearSelection() {
        this.nodes.forEach(node => {
            node.element.classList.remove('selected');
        });
        this.selectedNode = null;
        this.clearProperties();
    }

    // Properties Panel
    showNodeProperties(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node || !this.propertiesPanel) return;

        const config = this.getNodeConfig(node.type);
        
        let html = `
            <h4><i class="${config.icon}"></i> ${config.title} Properties</h4>
            <div class="property-group">
                <label class="property-label">Node ID</label>
                <input type="text" class="property-input" value="${nodeId}" disabled>
            </div>
        `;

        if (node.type === 'start') {
            html += `
                <div class="property-group">
                    <p><i class="fas fa-info-circle"></i> This is the workflow start point. All execution begins here.</p>
                </div>
            `;
        } else {
            config.fields.forEach(field => {
                const value = node.data[field.name] || field.defaultValue || '';
                html += `
                    <div class="property-group">
                        <label class="property-label">${field.label}${field.required ? ' *' : ''}</label>
                        ${this.createPropertyField(field, value, nodeId)}
                        ${field.description ? `<small class="property-help">${field.description}</small>` : ''}
                    </div>
                `;
            });
        }

        if (node.type !== 'start') {
            const editorInstance = this.mode === 'edit' ? 'editWorkflowEditor' : 'workflowEditor';
            html += `
                <div class="property-group">
                    <button class="btn btn-danger btn-sm" onclick="${editorInstance}.deleteNode('${nodeId}')">
                        <i class="fas fa-trash"></i> Delete Node
                    </button>
                </div>
            `;
        }

        this.propertiesPanel.innerHTML = html;
    }

    createPropertyField(field, value, nodeId) {
        const fieldId = `prop_${nodeId}_${field.name}`;
        const editorInstance = this.mode === 'edit' ? 'editWorkflowEditor' : 'workflowEditor';
        const onChange = `${editorInstance}.updateNodeData('${nodeId}', '${field.name}', this.${field.type === 'checkbox' ? 'checked' : 'value'})`;
        
        switch (field.type) {
            case 'textarea':
                return `<textarea id="${fieldId}" class="property-input" rows="3" onchange="${onChange}" placeholder="${field.placeholder || ''}">${value}</textarea>`;
            case 'select':
                const options = field.options.map(opt => 
                    `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                return `<select id="${fieldId}" class="property-input" onchange="${onChange}">${options}</select>`;
            case 'checkbox':
                return `<label><input type="checkbox" id="${fieldId}" class="property-input" ${value ? 'checked' : ''} onchange="${onChange}"> ${field.checkboxLabel || 'Enable'}</label>`;
            case 'number':
                return `<input type="number" id="${fieldId}" class="property-input" value="${value}" 
                           min="${field.min || 0}" max="${field.max || 999999}" onchange="${onChange}" 
                           placeholder="${field.placeholder || ''}">`;
            default:
                return `<input type="${field.type}" id="${fieldId}" class="property-input" value="${value}" onchange="${onChange}" 
                           placeholder="${field.placeholder || ''}">`;
        }
    }

    updateNodeData(nodeId, fieldName, value) {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.data[fieldName] = value;
            this.updateWorkflowData();
        }
    }

    clearProperties() {
        if (!this.propertiesPanel) return;
        
        this.propertiesPanel.innerHTML = `
            <div style="text-align: center; padding: 40px 0; color: #9ca3af;">
                <i class="fas fa-mouse-pointer fa-2x" style="margin-bottom: 16px; display: block;"></i>
                <p>Select a node to edit its properties</p>
                <div style="margin-top: 20px; font-size: 12px; color: #6b7280;">
                    <p><strong>🚀 New in v2.0:</strong></p>
                    <p>• Enhanced navigation controls</p>
                    <p>• Advanced keyboard interactions</p>
                    <p>• Data extraction capabilities</p>
                    <p>• Multi-tab browser support</p>
                    <p>• Variable system</p>
                    <hr style="margin: 12px 0; border-color: #e5e7eb;">
                    <p><strong>Quick Tips:</strong></p>
                    <p>• Drag nodes from the left palette</p>
                    <p>• Click nodes to select and edit</p>
                    <p>• Drag from connection points to link nodes</p>
                    <p>• Double-click connections to remove</p>
                    <p>• Use mouse wheel to zoom</p>
                    <p>• Drag empty space to pan</p>
                </div>
            </div>
        `;
    }

    // Enhanced Node Configuration with New Nodes
    getNodeConfig(type) {
        const configs = {
            'start': {
                title: 'Start',
                icon: 'fas fa-play',
                description: 'Workflow start point',
                defaultData: {},
                fields: []
            },
            
            // BASIC ACTIONS
            'open_browser': {
                title: 'Open Browser',
                icon: 'fas fa-globe',
                description: 'Open a web page in browser',
                defaultData: { url: 'https://example.com' },
                fields: [
                    { name: 'url', label: 'URL', type: 'url', defaultValue: 'https://example.com', required: true,
                      placeholder: 'https://example.com', description: 'The URL to navigate to' }
                ]
            },
            'wait': {
                title: 'Wait',
                icon: 'fas fa-clock',
                description: 'Wait for specified duration',
                defaultData: { duration: 5 },
                fields: [
                    { name: 'duration', label: 'Duration (seconds)', type: 'number', defaultValue: 5, min: 1, max: 300, required: true,
                      placeholder: '5', description: 'How long to wait in seconds' }
                ]
            },
            'wait_element': {
                title: 'Wait for Element',
                icon: 'fas fa-search',
                description: 'Wait until element appears',
                defaultData: { xpath: '', timeout: 10 },
                fields: [
                    { name: 'xpath', label: 'Element XPath', type: 'text', defaultValue: '', required: true,
                      placeholder: '//button[@id="submit"]', description: 'XPath selector for the element to wait for' },
                    { name: 'timeout', label: 'Timeout (seconds)', type: 'number', defaultValue: 10, min: 1, max: 60,
                      placeholder: '10', description: 'Maximum time to wait for element' }
                ]
            },

            // NAVIGATION NODES (NEW)
            'new_tab': {
                title: 'New Tab',
                icon: 'fas fa-plus-square',
                description: 'Open a new browser tab',
                defaultData: { url: '', tab_variable: 'new_tab' },
                fields: [
                    { name: 'url', label: 'URL (optional)', type: 'url', defaultValue: '',
                      placeholder: 'https://example.com', description: 'URL to open in new tab (leave empty for blank tab)' },
                    { name: 'tab_variable', label: 'Tab Variable Name', type: 'text', defaultValue: 'new_tab', required: true,
                      placeholder: 'new_tab', description: 'Variable name to reference this tab later' }
                ]
            },
            'activate_tab': {
                title: 'Activate Tab',
                icon: 'fas fa-window-restore',
                description: 'Switch to a specific tab',
                defaultData: { tab_variable: 'main_tab' },
                fields: [
                    { name: 'tab_variable', label: 'Tab Variable Name', type: 'text', defaultValue: 'main_tab', required: true,
                      placeholder: 'main_tab', description: 'Name of the tab variable to switch to' }
                ]
            },
            'open_url': {
                title: 'Open URL',
                icon: 'fas fa-external-link-alt',
                description: 'Navigate to URL in current tab',
                defaultData: { url: 'https://example.com' },
                fields: [
                    { name: 'url', label: 'URL', type: 'url', defaultValue: 'https://example.com', required: true,
                      placeholder: 'https://example.com', description: 'URL to navigate to in current tab' }
                ]
            },
            'close_tab': {
                title: 'Close Tab',
                icon: 'fas fa-times-circle',
                description: 'Close current or specific tab',
                defaultData: { tab_variable: '', close_current: true },
                fields: [
                    { name: 'close_current', label: 'Close Current Tab', type: 'checkbox', defaultValue: true,
                      checkboxLabel: 'Close currently active tab', description: 'If unchecked, specify tab variable below' },
                    { name: 'tab_variable', label: 'Tab Variable (if not current)', type: 'text', defaultValue: '',
                      placeholder: 'tab_name', description: 'Variable name of specific tab to close' }
                ]
            },
            'go_back': {
                title: 'Go Back',
                icon: 'fas fa-arrow-left',
                description: 'Navigate back in browser history',
                defaultData: { steps: 1 },
                fields: [
                    { name: 'steps', label: 'Steps Back', type: 'number', defaultValue: 1, min: 1, max: 10,
                      placeholder: '1', description: 'Number of pages to go back' }
                ]
            },
            'reload_page': {
                title: 'Reload Page',
                icon: 'fas fa-redo',
                description: 'Reload the current page',
                defaultData: { force_reload: false },
                fields: [
                    { name: 'force_reload', label: 'Force Reload', type: 'checkbox', defaultValue: false,
                      checkboxLabel: 'Force reload (bypass cache)', description: 'Force reload ignoring cached content' }
                ]
            },

            // USER INTERACTIONS (ENHANCED)
            'click': {
                title: 'Click Element',
                icon: 'fas fa-mouse-pointer',
                description: 'Click on a page element',
                defaultData: { xpath: '', wait_timeout: 10, click_type: 'single' },
                fields: [
                    { name: 'xpath', label: 'XPath', type: 'text', defaultValue: '', required: true,
                      placeholder: '//button[@id="submit"]', description: 'XPath selector for element to click' },
                    { name: 'click_type', label: 'Click Type', type: 'select', defaultValue: 'single',
                      options: [
                          { value: 'single', label: 'Single Click' },
                          { value: 'double', label: 'Double Click' },
                          { value: 'right', label: 'Right Click' }
                      ], description: 'Type of mouse click to perform' },
                    { name: 'wait_timeout', label: 'Wait Timeout (sec)', type: 'number', defaultValue: 10, min: 1, max: 60,
                      placeholder: '10', description: 'Time to wait for element before clicking' }
                ]
            },
            'type_text': {
                title: 'Type Text',
                icon: 'fas fa-keyboard',
                description: 'Type text into an input field',
                defaultData: { xpath: '', text: '', clear_first: true, typing_speed: 'normal' },
                fields: [
                    { name: 'xpath', label: 'Input XPath', type: 'text', defaultValue: '', required: true,
                      placeholder: '//input[@name="username"]', description: 'XPath selector for input field' },
                    { name: 'text', label: 'Text to Type', type: 'textarea', defaultValue: '', required: true,
                      placeholder: 'Enter your text here...', description: 'Text content to type into the field' },
                    { name: 'clear_first', label: 'Clear Field First', type: 'checkbox', defaultValue: true,
                      checkboxLabel: 'Clear existing content before typing', description: 'Clear field before entering new text' },
                    { name: 'typing_speed', label: 'Typing Speed', type: 'select', defaultValue: 'normal',
                      options: [
                          { value: 'slow', label: 'Slow (Human-like)' },
                          { value: 'normal', label: 'Normal' },
                          { value: 'fast', label: 'Fast' }
                      ], description: 'Speed of text entry simulation' }
                ]
            },
            'scroll': {
                title: 'Scroll Page',
                icon: 'fas fa-scroll',
                description: 'Scroll the page or element',
                defaultData: { direction: 'down', pixels: 500, target_element: '', smooth: true },
                fields: [
                    { name: 'direction', label: 'Direction', type: 'select', defaultValue: 'down',
                      options: [
                          { value: 'up', label: 'Up' },
                          { value: 'down', label: 'Down' },
                          { value: 'left', label: 'Left' },
                          { value: 'right', label: 'Right' },
                          { value: 'top', label: 'To Top' },
                          { value: 'bottom', label: 'To Bottom' }
                      ], description: 'Direction to scroll' },
                    { name: 'pixels', label: 'Pixels', type: 'number', defaultValue: 500, min: 1, max: 5000,
                      placeholder: '500', description: 'Number of pixels to scroll (ignored for top/bottom)' },
                    { name: 'target_element', label: 'Target Element (optional)', type: 'text', defaultValue: '',
                      placeholder: '//div[@class="content"]', description: 'XPath of element to scroll (leave empty for page)' },
                    { name: 'smooth', label: 'Smooth Scroll', type: 'checkbox', defaultValue: true,
                      checkboxLabel: 'Enable smooth scrolling animation', description: 'Use smooth scrolling effect' }
                ]
            },

            // KEYBOARD NODES (NEW)
            'press_key': {
                title: 'Press Key',
                icon: 'fas fa-keyboard',
                description: 'Press keyboard keys or combinations',
                defaultData: { key_combination: 'Enter', modifier_keys: '', hold_duration: 0.1 },
                fields: [
                    { name: 'key_combination', label: 'Key/Combination', type: 'text', defaultValue: 'Enter', required: true,
                      placeholder: 'Enter, Escape, F5, etc.', description: 'Key name or combination (e.g., Ctrl+C, Alt+Tab)' },
                    { name: 'modifier_keys', label: 'Modifier Keys', type: 'select', defaultValue: '',
                      options: [
                          { value: '', label: 'None' },
                          { value: 'ctrl', label: 'Ctrl' },
                          { value: 'alt', label: 'Alt' },
                          { value: 'shift', label: 'Shift' },
                          { value: 'ctrl+shift', label: 'Ctrl+Shift' },
                          { value: 'ctrl+alt', label: 'Ctrl+Alt' },
                          { value: 'alt+shift', label: 'Alt+Shift' }
                      ], description: 'Additional modifier keys to hold' },
                    { name: 'hold_duration', label: 'Hold Duration (sec)', type: 'number', defaultValue: 0.1, min: 0.1, max: 5,
                      placeholder: '0.1', description: 'How long to hold the key combination' }
                ]
            },

            // DATA NODES (NEW)
            'element_exists': {
                title: 'Element Exists',
                icon: 'fas fa-search-plus',
                description: 'Check if element exists on page',
                defaultData: { xpath: '', save_result: true, result_variable: 'element_exists' },
                fields: [
                    { name: 'xpath', label: 'Element XPath', type: 'text', defaultValue: '', required: true,
                      placeholder: '//div[@class="success"]', description: 'XPath selector for element to check' },
                    { name: 'save_result', label: 'Save Result', type: 'checkbox', defaultValue: true,
                      checkboxLabel: 'Save result to variable', description: 'Store the boolean result in a variable' },
                    { name: 'result_variable', label: 'Result Variable Name', type: 'text', defaultValue: 'element_exists',
                      placeholder: 'element_exists', description: 'Variable name to store the result (true/false)' }
                ]
            },
            'get_text': {
                title: 'Get Text',
                icon: 'fas fa-font',
                description: 'Extract text from element',
                defaultData: { xpath: '', attribute: 'text', save_variable: 'extracted_text' },
                fields: [
                    { name: 'xpath', label: 'Element XPath', type: 'text', defaultValue: '', required: true,
                      placeholder: '//h1[@class="title"]', description: 'XPath selector for element to get text from' },
                    { name: 'attribute', label: 'Attribute to Extract', type: 'select', defaultValue: 'text',
                      options: [
                          { value: 'text', label: 'Text Content' },
                          { value: 'value', label: 'Value Attribute' },
                          { value: 'href', label: 'Href Attribute' },
                          { value: 'src', label: 'Src Attribute' },
                          { value: 'title', label: 'Title Attribute' },
                          { value: 'class', label: 'Class Attribute' },
                          { value: 'id', label: 'ID Attribute' }
                      ], description: 'What to extract from the element' },
                    { name: 'save_variable', label: 'Save to Variable', type: 'text', defaultValue: 'extracted_text', required: true,
                      placeholder: 'extracted_text', description: 'Variable name to store extracted content' }
                ]
            },

            // FILE OPERATIONS (EXISTING + ENHANCED)
            'upload': {
                title: 'Upload File',
                icon: 'fas fa-upload',
                description: 'Upload a file',
                defaultData: { xpath: '', file_path: '', wait_after: 2 },
                fields: [
                    { name: 'xpath', label: 'File Input XPath', type: 'text', defaultValue: '', required: true,
                      placeholder: '//input[@type="file"]', description: 'XPath selector for file input element' },
                    { name: 'file_path', label: 'File Path', type: 'text', defaultValue: '', required: true,
                      placeholder: '/path/to/file.pdf', description: 'Full path to the file to upload' },
                    { name: 'wait_after', label: 'Wait After Upload (sec)', type: 'number', defaultValue: 2, min: 0, max: 30,
                      placeholder: '2', description: 'Time to wait after file upload completes' }
                ]
            },
            'download': {
                title: 'Download File',
                icon: 'fas fa-download',
                description: 'Download a file',
                defaultData: { xpath: '', save_path: '', wait_timeout: 30 },
                fields: [
                    { name: 'xpath', label: 'Download Link XPath', type: 'text', defaultValue: '', required: true,
                      placeholder: '//a[@class="download-link"]', description: 'XPath selector for download link' },
                    { name: 'save_path', label: 'Save Path', type: 'text', defaultValue: '',
                      placeholder: '/path/to/downloads/', description: 'Directory to save downloaded file' },
                    { name: 'wait_timeout', label: 'Download Timeout (sec)', type: 'number', defaultValue: 30, min: 5, max: 300,
                      placeholder: '30', description: 'Maximum time to wait for download completion' }
                ]
            },
            'screenshot': {
                title: 'Take Screenshot',
                icon: 'fas fa-camera',
                description: 'Take a screenshot',
                defaultData: { save_path: '', full_page: false, element_xpath: '' },
                fields: [
                    { name: 'save_path', label: 'Save Path', type: 'text', defaultValue: '', required: true,
                      placeholder: '/path/to/screenshot.png', description: 'Full path where screenshot will be saved' },
                    { name: 'full_page', label: 'Full Page', type: 'checkbox', defaultValue: false,
                      checkboxLabel: 'Capture entire page (not just visible area)', description: 'Screenshot the full page content' },
                    { name: 'element_xpath', label: 'Element XPath (optional)', type: 'text', defaultValue: '',
                      placeholder: '//div[@id="content"]', description: 'XPath of specific element to screenshot' }
                ]
            },

            // CONTROL FLOW (EXISTING + ENHANCED)
            'condition': {
                title: 'Condition',
                icon: 'fas fa-code-branch',
                description: 'Conditional branching',
                defaultData: { condition_type: 'element_exists', xpath: '', expected_value: '', variable_name: '' },
                fields: [
                    { name: 'condition_type', label: 'Condition Type', type: 'select', defaultValue: 'element_exists', required: true,
                      options: [
                          { value: 'element_exists', label: 'Element Exists' },
                          { value: 'element_visible', label: 'Element Visible' },
                          { value: 'text_contains', label: 'Text Contains' },
                          { value: 'url_contains', label: 'URL Contains' },
                          { value: 'variable_equals', label: 'Variable Equals' },
                          { value: 'variable_contains', label: 'Variable Contains' }
                      ], description: 'Type of condition to evaluate' },
                    { name: 'xpath', label: 'XPath (if needed)', type: 'text', defaultValue: '',
                      placeholder: '//div[@class="message"]', description: 'XPath selector (for element-based conditions)' },
                    { name: 'expected_value', label: 'Expected Value', type: 'text', defaultValue: '',
                      placeholder: 'Success', description: 'Value to compare against' },
                    { name: 'variable_name', label: 'Variable Name (if needed)', type: 'text', defaultValue: '',
                      placeholder: 'my_variable', description: 'Variable name (for variable-based conditions)' }
                ]
            },
            'loop': {
                title: 'Loop',
                icon: 'fas fa-sync',
                description: 'Repeat actions',
                defaultData: { loop_type: 'count', count: 5, condition: '', max_iterations: 100 },
                fields: [
                    { name: 'loop_type', label: 'Loop Type', type: 'select', defaultValue: 'count',
                      options: [
                          { value: 'count', label: 'Fixed Count' },
                          { value: 'while', label: 'While Condition' },
                          { value: 'foreach', label: 'For Each Element' }
                      ], description: 'Type of loop to execute' },
                    { name: 'count', label: 'Count', type: 'number', defaultValue: 5, min: 1, max: 100,
                      placeholder: '5', description: 'Number of iterations (for fixed count)' },
                    { name: 'condition', label: 'Condition/XPath', type: 'text', defaultValue: '',
                      placeholder: '//div[@class="item"]', description: 'Condition or XPath (for while/foreach)' },
                    { name: 'max_iterations', label: 'Max Iterations', type: 'number', defaultValue: 100, min: 1, max: 1000,
                      placeholder: '100', description: 'Safety limit for maximum iterations' }
                ]
            },
            'javascript': {
                title: 'Execute JavaScript',
                icon: 'fas fa-code',
                description: 'Execute custom JavaScript code',
                defaultData: { script: 'console.log("Hello World");', return_variable: '' },
                fields: [
                    { name: 'script', label: 'JavaScript Code', type: 'textarea', defaultValue: 'console.log("Hello World");', required: true,
                      placeholder: 'console.log("Hello World");', description: 'JavaScript code to execute in browser context' },
                    { name: 'return_variable', label: 'Return Variable (optional)', type: 'text', defaultValue: '',
                      placeholder: 'js_result', description: 'Variable name to store script return value' }
                ]
            }
        };

        return configs[type] || configs['wait'];
    }

    // Workflow Operations
    updateCounts() {
        const nodeCountElement = document.getElementById(this.elementIds.nodeCount);
        const connectionCountElement = document.getElementById(this.elementIds.connectionCount);
        
        if (nodeCountElement) {
            nodeCountElement.textContent = `Nodes: ${this.nodes.size}`;
        }
        if (connectionCountElement) {
            connectionCountElement.textContent = `Connections: ${this.connections.size}`;
        }
    }

    updateWorkflowData() {
        const data = this.exportWorkflowData();
        const workflowDataElement = document.getElementById(this.elementIds.workflowData);
        if (workflowDataElement) {
            workflowDataElement.value = JSON.stringify(data);
        }
    }

    validateWorkflow() {
        const issues = [];
        
        if (!this.startNodeId || !this.nodes.has(this.startNodeId)) {
            issues.push('No start node found');
        }
        
        const connectedNodes = new Set([this.startNodeId]);
        this.connections.forEach(conn => {
            connectedNodes.add(conn.source);
            connectedNodes.add(conn.target);
        });
        
        this.nodes.forEach((node, nodeId) => {
            if (nodeId !== this.startNodeId && !connectedNodes.has(nodeId)) {
                issues.push(`Node ${nodeId} (${node.type}) is not connected to workflow`);
            }
        });
        
        // Enhanced validation for new node types
        this.nodes.forEach((node, nodeId) => {
            const config = this.getNodeConfig(node.type);
            config.fields.forEach(field => {
                if (field.required && (!node.data[field.name] || node.data[field.name] === '')) {
                    issues.push(`Node ${nodeId} (${node.type}): ${field.label} is required`);
                }
            });

            // Special validation for tab management nodes
            if (['activate_tab', 'close_tab'].includes(node.type)) {
                const tabVar = node.data.tab_variable;
                if (tabVar && !this.hasNodeCreatingTab(tabVar)) {
                    issues.push(`Node ${nodeId} (${node.type}): Tab variable "${tabVar}" is not created by any new_tab node`);
                }
            }
        });
        
        if (!this.hasValidExecutionPath()) {
            issues.push('No valid execution path from start node');
        }
        
        if (issues.length === 0) {
            alert('✅ Workflow validation passed!');
        } else {
            alert('❌ Validation issues:\n\n' + issues.join('\n'));
        }
        
        return issues.length === 0;
    }

    hasNodeCreatingTab(tabVariable) {
        for (let [nodeId, node] of this.nodes) {
            if (node.type === 'new_tab' && node.data.tab_variable === tabVariable) {
                return true;
            }
        }
        return false;
    }

    hasValidExecutionPath() {
        if (!this.startNodeId) return false;
        
        const visited = new Set();
        const stack = [this.startNodeId];
        
        while (stack.length > 0) {
            const currentId = stack.pop();
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            
            this.connections.forEach(conn => {
                if (conn.source === currentId) {
                    stack.push(conn.target);
                }
            });
        }
        
        return visited.size > 1;
    }

    clearWorkflow() {
        if (this.nodes.size <= 1 || confirm('Clear entire workflow? This will remove all nodes and connections.')) {
            this.nodes.clear();
            this.connections.clear();
            
            const svgMarkerId = this.mode === 'edit' ? 'editArrow' : 'arrow';
            this.canvasContainer.innerHTML = `
                <svg id="${this.elementIds.svg}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;">
                    <defs>
                        <marker id="${svgMarkerId}Success" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L0,6 L9,3 z" fill="#10b981"/>
                        </marker>
                        <marker id="${svgMarkerId}Error" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L0,6 L9,3 z" fill="#ef4444"/>
                        </marker>
                    </defs>
                </svg>
            `;
            this.svg = document.getElementById(this.elementIds.svg);
            this.selectedNode = null;
            this.nodeCounter = 0;
            this.startNodeId = null;
            this.tabVariables.clear();
            this.currentTabVariable = 'main_tab';
            this.clearProperties();
            this.updateCounts();
            
            if (this.mode === 'create') {
                this.createStartNode();
            }
            
            this.updateWorkflowData();
        }
    }

    exportWorkflowData() {
        const nodes = [];
        const connections = [];
        
        this.nodes.forEach(node => {
            nodes.push({
                id: node.id,
                type: node.type,
                position: node.position,
                data: node.data,
                isStart: node.id === this.startNodeId
            });
        });
        
        this.connections.forEach(conn => {
            connections.push({
                source: conn.source,
                target: conn.target,
                type: conn.type
            });
        });
        
        return {
            workflow_type: 'visual',
            nodes: nodes,
            connections: connections,
            startNode: this.startNodeId,
            metadata: {
                created: new Date().toISOString(),
                nodeCount: nodes.length,
                connectionCount: connections.length,
                version: '2.0',
                mode: this.mode
            }
        };
    }

    exportWorkflow() {
        const data = this.exportWorkflowData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workflow_${this.mode}_${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importWorkflow(data) {
        if (data.workflow_type === 'visual' && data.nodes) {
            this.clearWorkflow();
            
            // Import nodes
            data.nodes.forEach(nodeData => {
                if (nodeData.type !== 'start') {
                    const nodeId = this.createNode(nodeData.type, nodeData.position.x, nodeData.position.y);
                    const node = this.nodes.get(nodeId);
                    if (node) {
                        node.data = { ...nodeData.data };
                        node.id = nodeData.id;
                        node.element.id = nodeData.id;
                        this.nodes.delete(nodeId);
                        this.nodes.set(nodeData.id, node);
                    }
                } else if (this.mode === 'create') {
                    // Update start node position
                    const startNode = this.nodes.get(this.startNodeId);
                    if (startNode) {
                        startNode.position = nodeData.position;
                        startNode.element.style.left = `${nodeData.position.x}px`;
                        startNode.element.style.top = `${nodeData.position.y}px`;
                    }
                } else {
                    // For edit mode, create start node if it doesn't exist
                    if (!this.startNodeId) {
                        this.createStartNode();
                        const startNode = this.nodes.get(this.startNodeId);
                        if (startNode) {
                            startNode.position = nodeData.position;
                            startNode.element.style.left = `${nodeData.position.x}px`;
                            startNode.element.style.top = `${nodeData.position.y}px`;
                            startNode.data = { ...nodeData.data };
                            startNode.id = nodeData.id;
                            startNode.element.id = nodeData.id;
                            this.nodes.delete(this.startNodeId);
                            this.nodes.set(nodeData.id, startNode);
                            this.startNodeId = nodeData.id;
                        }
                    }
                }
            });
            
            // Import connections
            if (data.connections) {
                data.connections.forEach(connData => {
                    this.createConnection(connData.source, connData.target, connData.type);
                });
            }
            
            this.updateCounts();
            this.updateWorkflowData();
            console.log(`Workflow imported successfully to ${this.mode} mode!`);
        } else {
            alert('Invalid workflow format');
        }
    }

    // New methods for Edit Mode
    loadWorkflowData(data) {
        console.log('Loading workflow data for edit mode:', data);
        if (data && data.workflow_type === 'visual') {
            this.importWorkflow(data);
        } else if (Array.isArray(data)) {
            // Handle legacy format conversion
            console.log('Legacy format detected - converting to visual format');
            this.convertLegacyFormat(data);
        } else {
            console.warn('Unknown workflow data format:', data);
        }
    }

    convertLegacyFormat(legacySteps) {
        // Convert legacy linear format to visual format
        // This is a basic implementation - you might need to enhance based on your legacy format
        this.clearWorkflow();
        
        let lastNodeId = this.startNodeId;
        let yOffset = 150;
        
        legacySteps.forEach((step, index) => {
            if (step.type && step.type !== 'start') {
                const nodeId = this.createNode(step.type, 200, yOffset);
                const node = this.nodes.get(nodeId);
                
                if (node && step.data) {
                    node.data = { ...step.data };
                }
                
                if (lastNodeId) {
                    this.createConnection(lastNodeId, nodeId, 'success');
                }
                
                lastNodeId = nodeId;
                yOffset += 100;
            }
        });
        
        this.updateCounts();
        this.updateWorkflowData();
    }

    getWorkflowData() {
        return this.exportWorkflowData();
    }

    autoLayout() {
        // Auto-layout algorithm for better node positioning
        const nodes = Array.from(this.nodes.values());
        if (nodes.length <= 1) return;

        // Simple tree layout algorithm
        const visited = new Set();
        const levels = new Map();
        
        // BFS to determine levels
        const queue = [{ id: this.startNodeId, level: 0 }];
        levels.set(this.startNodeId, 0);
        visited.add(this.startNodeId);
        
        while (queue.length > 0) {
            const { id, level } = queue.shift();
            
            this.connections.forEach(conn => {
                if (conn.source === id && !visited.has(conn.target)) {
                    visited.add(conn.target);
                    levels.set(conn.target, level + 1);
                    queue.push({ id: conn.target, level: level + 1 });
                }
            });
        }
        
        // Group nodes by level
        const nodesByLevel = new Map();
        levels.forEach((level, nodeId) => {
            if (!nodesByLevel.has(level)) {
                nodesByLevel.set(level, []);
            }
            nodesByLevel.get(level).push(nodeId);
        });
        
        // Position nodes
        const levelWidth = 300;
        const nodeHeight = 120;
        const startX = 100;
        const startY = 100;
        
        nodesByLevel.forEach((nodeIds, level) => {
            const x = startX + level * levelWidth;
            nodeIds.forEach((nodeId, index) => {
                const y = startY + index * nodeHeight;
                const node = this.nodes.get(nodeId);
                if (node) {
                    node.position.x = x;
                    node.position.y = y;
                    node.element.style.left = `${x}px`;
                    node.element.style.top = `${y}px`;
                }
            });
        });
        
        this.updateAllConnections();
        this.updateWorkflowData();
        
        // Animate to show the change
        this.resetZoom();
    }

    onFormSubmit(e) {
        // Ensure workflow data is up to date
        this.updateWorkflowData();
        
        // Basic validation
        const nameElement = document.getElementById('workflowName') || document.getElementById('editWorkflowName');
        const name = nameElement ? nameElement.value.trim() : '';
        
        if (!name) {
            e.preventDefault();
            alert('Please enter a workflow name');
            return false;
        }
        
        if (this.nodes.size <= 1) {
            e.preventDefault();
            alert('Please add at least one action node to your workflow');
            return false;
        }
        
        // Validate workflow structure
        if (!this.validateWorkflow()) {
            const proceed = confirm('Workflow has validation issues. Save anyway?');
            if (!proceed) {
                e.preventDefault();
                return false;
            }
        }
        
        return true;
    }
}

// Global workflow editor instances
let workflowEditor = null;
let editWorkflowEditor = null;
let uiController = null;

// Global functions for workflow management
function loadWorkflowPreview(scenarioId, stepsJson) {
    try {
        let nodeCount = 0;
        let workflowType = 'Linear';
        
        if (typeof stepsJson === 'string') {
            const data = JSON.parse(stepsJson);
            if (data.workflow_type === 'visual' && data.nodes) {
                nodeCount = data.nodes.length;
                workflowType = 'Visual v2.0';
            } else {
                nodeCount = Array.isArray(data) ? data.length : 0;
            }
        } else if (Array.isArray(stepsJson)) {
            nodeCount = stepsJson.length;
        } else if (stepsJson && stepsJson.nodes) {
            nodeCount = stepsJson.nodes.length;
            workflowType = 'Visual v2.0';
        }
        
        const countElement = document.getElementById('nodeCount' + scenarioId);
        if (countElement) countElement.textContent = `${nodeCount} nodes (${workflowType})`;
    } catch (error) {
        console.error('Error loading workflow preview:', error);
        const countElement = document.getElementById('nodeCount' + scenarioId);
        if (countElement) countElement.textContent = 'Error';
    }
}

function loadAdminScenarioPreview(scenarioId, stepsJson) {
    try {
        let nodeCount = 0;
        let workflowType = 'Linear';
        
        if (typeof stepsJson === 'string') {
            const data = JSON.parse(stepsJson);
            if (data.workflow_type === 'visual' && data.nodes) {
                nodeCount = data.nodes.length;
                workflowType = 'Visual v2.0';
            } else {
                nodeCount = Array.isArray(data) ? data.length : 0;
            }
        } else if (Array.isArray(stepsJson)) {
            nodeCount = stepsJson.length;
        } else if (stepsJson && stepsJson.nodes) {
            nodeCount = stepsJson.nodes.length;
            workflowType = 'Visual v2.0';
        }
        
        const countElement = document.getElementById('adminStepCount' + scenarioId);
        if (countElement) countElement.textContent = `${nodeCount} steps (${workflowType})`;
    } catch (error) {
        console.error('Error loading admin scenario preview:', error);
        const countElement = document.getElementById('adminStepCount' + scenarioId);
        if (countElement) countElement.textContent = 'Error';
    }
}

function viewWorkflow(scenarioId) {
    fetch(`/api/scenarios/${scenarioId}`)
        .then(response => response.json())
        .then(scenario => displayWorkflowViewer(scenario))
        .catch(error => {
            console.error('Error loading workflow:', error);
            alert('Error loading workflow details');
        });
}

async function editWorkflow(scenarioId) {
    try {
        showLoadingModal('Loading workflow for editing...');
        
        // Fetch workflow data for editing
        const response = await fetch(`/api/scenarios/${scenarioId}/edit`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const workflowData = await response.json();
        hideLoadingModal();
        
        // Open edit modal and populate data
        openEditWorkflowModal(workflowData);
        
    } catch (error) {
        hideLoadingModal();
        console.error('Error loading workflow for edit:', error);
        alert('Error loading workflow for editing: ' + error.message);
    }
}

function openEditWorkflowModal(workflowData) {
    // Populate form fields
    document.getElementById('editScenarioId').value = workflowData.id;
    document.getElementById('editWorkflowName').value = workflowData.name;
    document.getElementById('editWorkflowDescription').value = workflowData.description;
    document.getElementById('editWorkflowIsPublic').checked = workflowData.is_public;
    
    // Set up form action
    const editForm = document.getElementById('editWorkflowForm');
    editForm.action = `/web/scenarios/${workflowData.id}`;
    
    // Initialize edit workflow editor
    if (!editWorkflowEditor) {
        editWorkflowEditor = new VisualWorkflowEditor('edit');
    }
    
    // Load workflow data into editor
    if (workflowData.steps) {
        editWorkflowEditor.loadWorkflowData(workflowData.steps);
    }
    
    // Show modal
    document.getElementById('editWorkflowModal').style.display = 'block';
    
    // Setup form submission
    editForm.onsubmit = function(e) {
        e.preventDefault();
        saveEditWorkflow(workflowData.id);
    };
}

async function saveEditWorkflow(scenarioId) {
    try {
        showLoadingModal('Saving workflow changes...');
        
        // Get workflow data from editor
        const workflowData = editWorkflowEditor.getWorkflowData();
        document.getElementById('editWorkflowData').value = JSON.stringify(workflowData);
        
        // Create form data
        const formData = new FormData(document.getElementById('editWorkflowForm'));
        
        // Submit to server
        const response = await fetch(`/web/scenarios/${scenarioId}`, {
            method: 'POST',
            body: formData
        });
        
        hideLoadingModal();
        
        if (response.ok) {
            closeModal('editWorkflowModal');
            showSuccessMessage('Workflow updated successfully!');
            // Refresh the page to show updated data
            setTimeout(() => window.location.reload(), 1000);
        } else {
            throw new Error('Failed to save workflow');
        }
        
    } catch (error) {
        hideLoadingModal();
        console.error('Error saving workflow:', error);
        alert('Error saving workflow: ' + error.message);
    }
}

function saveWorkflowChanges() {
    // Legacy function for compatibility
    const scenarioId = document.getElementById('editWorkflowId')?.value;
    if (scenarioId) {
        saveEditWorkflow(scenarioId);
    }
}

function displayWorkflowViewer(scenario) {
    document.getElementById('workflowViewTitle').innerHTML = 
        `<i class="fas fa-project-diagram"></i> ${scenario.name}`;
    
    let content = `
        <div class="workflow-details">
            <h4>📊 Workflow Information</h4>
            <p><strong>Name:</strong> ${scenario.name}</p>
            <p><strong>Description:</strong> ${scenario.description || 'No description'}</p>
            <p><strong>Status:</strong> ${scenario.is_public ? '🌐 Public' : '🔒 Private'}</p>
            <p><strong>Created:</strong> ${new Date(scenario.created_at).toLocaleDateString()}</p>
    `;
    
    let workflowData = scenario.steps;
    if (typeof workflowData === 'string') {
        workflowData = JSON.parse(workflowData);
    }
    
    if (workflowData && workflowData.workflow_type === 'visual') {
        const version = workflowData.metadata?.version || '1.0';
        content += `
            <h4>🎨 Enhanced Visual Workflow (v${version})</h4>
            <p><strong>Nodes:</strong> ${workflowData.nodes?.length || 0}</p>
            <p><strong>Connections:</strong> ${workflowData.connections?.length || 0}</p>
            <p><strong>Start Node:</strong> ${workflowData.startNode || 'Not defined'}</p>
        `;
        
        if (workflowData.nodes) {
            // Group nodes by type
            const nodesByType = {};
            workflowData.nodes.forEach(node => {
                if (!nodesByType[node.type]) nodesByType[node.type] = [];
                nodesByType[node.type].push(node);
            });
            
            content += `<h5>📋 Node Summary:</h5>`;
            content += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">`;
            
            Object.entries(nodesByType).forEach(([type, nodes]) => {
                const icons = {
                    'start': '▶️', 'open_browser': '🌐', 'wait': '⏱️', 'wait_element': '🔍',
                    'new_tab': '📑', 'activate_tab': '🔄', 'open_url': '🔗', 'close_tab': '❌',
                    'go_back': '⬅️', 'reload_page': '🔄', 'click': '👆', 'type_text': '⌨️',
                    'scroll': '📜', 'press_key': '🔧', 'element_exists': '👁️', 'get_text': '📝',
                    'upload': '📤', 'download': '📥', 'screenshot': '📷', 'javascript': '💻',
                    'condition': '🔀', 'loop': '🔄'
                };
                const icon = icons[type] || '⚙️';
                content += `
                    <div style="background: #f8fafc; padding: 8px; border-radius: 6px; border-left: 3px solid #3b82f6;">
                        <strong>${icon} ${type.replace(/_/g, ' ').toUpperCase()}</strong><br>
                        <small>${nodes.length} node${nodes.length > 1 ? 's' : ''}</small>
                    </div>
                `;
            });
            content += `</div>`;
        }

        if (workflowData.connections && workflowData.connections.length > 0) {
            const successConnections = workflowData.connections.filter(c => c.type === 'success').length;
            const errorConnections = workflowData.connections.filter(c => c.type === 'error').length;
            
            content += `<h5>🔗 Connection Details:</h5>`;
            content += `<p>✅ Success paths: ${successConnections} | ❌ Error paths: ${errorConnections}</p>`;
        }
    } else {
        content += `
            <h4>📋 Linear Workflow (Legacy)</h4>
            <p><strong>Steps:</strong> ${Array.isArray(workflowData) ? workflowData.length : 0}</p>
            <div style="background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 3px solid #f59e0b; margin: 10px 0;">
                <strong>💡 Upgrade Tip:</strong> Convert this to Visual Workflow v2.0 for enhanced features!
            </div>
        `;
    }
    
    content += `</div>`;
    
    document.getElementById('workflowViewBody').innerHTML = content;
    document.getElementById('workflowViewModal').style.display = 'block';
}

// UI and interaction functions
function filterScenarios() {
    const filterType = document.getElementById('filterType').value;
    const scenarioCards = document.querySelectorAll('.scenario-card');
    
    scenarioCards.forEach(card => {
        const isPublic = card.getAttribute('data-public') === 'True';
        let show = filterType === 'all' || 
                  (filterType === 'public' && isPublic) || 
                  (filterType === 'private' && !isPublic);
        
        card.style.display = show ? 'block' : 'none';
    });
}

function refreshWorkflows() { 
    window.location.reload(); 
}

function duplicateWorkflow(scenarioId) { 
    if (confirm('Create a copy of this enhanced workflow?')) {
        console.log('Duplicating enhanced workflow:', scenarioId);
        // Implementation would be added here
    }
}

function toggleJsonInput() { 
    const area = document.getElementById('jsonInputArea'); 
    area.style.display = area.style.display === 'none' ? 'block' : 'none'; 
}

function closeModal(modalId) { 
    document.getElementById(modalId).style.display = 'none';
    
    // Clean up edit workflow editor if closing edit modal
    if (modalId === 'editWorkflowModal' && editWorkflowEditor) {
        editWorkflowEditor.clearWorkflow();
    }
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (file && file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (workflowEditor) workflowEditor.importWorkflow(data);
                closeModal('importWorkflowModal');
            } catch (error) {
                alert('Invalid JSON file: ' + error.message);
            }
        };
        reader.readAsText(file);
    } else {
        alert('Please select a valid JSON file');
    }
}

function importFromJson() {
    const jsonText = document.getElementById('jsonInput').value.trim();
    if (jsonText) {
        try {
            const data = JSON.parse(jsonText);
            if (workflowEditor) workflowEditor.importWorkflow(data);
            closeModal('importWorkflowModal');
        } catch (error) {
            alert('Invalid JSON: ' + error.message);
        }
    } else {
        alert('Please paste valid JSON data');
    }
}

// Utility functions
function showLoadingModal(message) {
    const loadingModal = document.createElement('div');
    loadingModal.id = 'loadingModal';
    loadingModal.className = 'modal';
    loadingModal.style.display = 'block';
    loadingModal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; text-align: center;">
            <div class="modal-body" style="padding: 40px;">
                <div class="loading" style="margin: 0 auto 20px;"></div>
                <p>${message}</p>
            </div>
        </div>
    `;
    document.body.appendChild(loadingModal);
}

function hideLoadingModal() {
    const loadingModal = document.getElementById('loadingModal');
    if (loadingModal) {
        loadingModal.remove();
    }
}

function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
        <button class="close-alert">&times;</button>
    `;
    
    let flashContainer = document.querySelector('.flash-messages');
    if (!flashContainer) {
        flashContainer = document.createElement('div');
        flashContainer.className = 'flash-messages';
        document.body.appendChild(flashContainer);
    }
    
    flashContainer.appendChild(successDiv);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        successDiv.style.opacity = '0';
        setTimeout(() => successDiv.remove(), 300);
    }, 3000);
    
    // Add click handler for close button
    successDiv.querySelector('.close-alert').addEventListener('click', function() {
        successDiv.remove();
    });
}

// Main initialization functions
function initializeApp() {
    setupEventListeners();
    uiController = new UIController();
    
    // Add version info to console
    console.log('%c🚀 Enhanced Browser Automation v2.0', 'color: #3b82f6; font-weight: bold; font-size: 14px;');
    console.log('%c✨ New Features: Navigation, Keyboard, Data Extraction, Edit Workflow', 'color: #10b981; font-size: 12px;');
}

function setupEventListeners() {
    const toggleBtn = document.getElementById('toggleWorkflowEditor');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleWorkflowEditor);
    }
    
    document.querySelectorAll('.close-alert').forEach(btn => {
        btn.addEventListener('click', function() { this.parentElement.remove(); });
    });
    
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) e.target.style.display = 'none';
    });

    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 's':
                    e.preventDefault();
                    if (workflowEditor && document.getElementById('workflowEditorContainer')?.style.display !== 'none') {
                        document.getElementById('workflowForm').requestSubmit();
                    } else if (editWorkflowEditor && document.getElementById('editWorkflowModal')?.style.display !== 'none') {
                        document.getElementById('editWorkflowForm').requestSubmit();
                    }
                    break;
                case 'n':
                    e.preventDefault();
                    const toggleBtn = document.getElementById('toggleWorkflowEditor');
                    if (toggleBtn) toggleBtn.click();
                    break;
            }
        }
    });
}

function setupFlashMessages() {
    setTimeout(() => {
        document.querySelectorAll('.alert').forEach(alert => {
            alert.style.transition = 'opacity 0.5s ease';
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 500);
        });
    }, 5000);
}

function toggleWorkflowEditor() {
    const container = document.getElementById('workflowEditorContainer');
    const button = document.getElementById('toggleWorkflowEditor');
    
    if (!container || !button) return;
    
    if (container.style.display === 'none' || !container.style.display) {
        container.style.display = 'block';
        button.innerHTML = '<i class="fas fa-minus"></i> Cancel';
        button.className = 'btn btn-secondary';
        
        if (!workflowEditor) {
            workflowEditor = new VisualWorkflowEditor('create');
        }
        
        container.scrollIntoView({ behavior: 'smooth' });
    } else {
        cancelWorkflowCreate();
    }
}

function cancelWorkflowCreate() {
    const container = document.getElementById('workflowEditorContainer');
    const button = document.getElementById('toggleWorkflowEditor');
    
    if (!container || !button) return;
    
    container.style.display = 'none';
    button.innerHTML = '<i class="fas fa-plus"></i> New Workflow';
    button.className = 'btn btn-primary';
    
    const form = document.getElementById('workflowForm');
    if (form) form.reset();
    
    if (workflowEditor) {
        workflowEditor.clearWorkflow();
    }
}

// Enhanced UI Controller Class
class UIController {
    constructor() {
        this.isFullscreen = false;
        this.sidebarCollapsed = false;
        this.propertiesCollapsed = false;
        this.init();
    }

    init() {
        this.setupToggleButtons();
        this.setupKeyboardShortcuts();
        this.setupEnhancedFeatures();
    }

    setupEnhancedFeatures() {
        // Add enhanced tooltips
        document.querySelectorAll('[title]').forEach(el => {
            el.addEventListener('mouseenter', this.showTooltip);
            el.addEventListener('mouseleave', this.hideTooltip);
        });
    }

    showTooltip(e) {
        // Enhanced tooltip implementation
        const tooltip = document.createElement('div');
        tooltip.className = 'enhanced-tooltip';
        tooltip.textContent = e.target.getAttribute('title');
        tooltip.style.cssText = `
            position: absolute;
            background: #1f2937;
            color: white;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 9999;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(tooltip);
        
        const rect = e.target.getBoundingClientRect();
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.top - tooltip.offsetHeight - 8) + 'px';
    }

    hideTooltip(e) {
        const tooltip = document.querySelector('.enhanced-tooltip');
        if (tooltip) tooltip.remove();
    }

    setupToggleButtons() {
        const sidebar = document.querySelector('.workflow-sidebar');
        const properties = document.querySelector('.node-properties');
        
        if (sidebar && !sidebar.querySelector('.sidebar-toggle')) {
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'sidebar-toggle';
            toggleBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            toggleBtn.onclick = () => this.toggleSidebar();
            sidebar.parentNode.appendChild(toggleBtn);
        }

        if (properties && !properties.querySelector('.properties-toggle')) {
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'properties-toggle';
            toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
            toggleBtn.onclick = () => this.toggleProperties();
            properties.parentNode.appendChild(toggleBtn);
        }

        // Enhanced fullscreen controls
        const fullscreenControls = document.getElementById('toggleFullscreen');
        const compactControls = document.getElementById('toggleCompact');
        const resetControls = document.getElementById('resetLayout');
        
        if (fullscreenControls) fullscreenControls.onclick = () => this.toggleFullscreen();
        if (compactControls) compactControls.onclick = () => this.toggleCompactMode();
        if (resetControls) resetControls.onclick = () => this.resetLayout();
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.workflow-sidebar');
        const editor = document.querySelector('.workflow-editor');
        
        this.sidebarCollapsed = !this.sidebarCollapsed;
        
        sidebar?.classList.toggle('collapsed', this.sidebarCollapsed);
        editor?.classList.toggle('sidebar-collapsed', this.sidebarCollapsed);
        
        this.updateCanvasLayout();
    }

    toggleProperties() {
        const properties = document.querySelector('.node-properties');
        const editor = document.querySelector('.workflow-editor');
        
        this.propertiesCollapsed = !this.propertiesCollapsed;
        
        properties?.classList.toggle('collapsed', this.propertiesCollapsed);
        editor?.classList.toggle('properties-collapsed', this.propertiesCollapsed);
        
        this.updateCanvasLayout();
    }

    toggleFullscreen() {
        const editor = document.querySelector('.workflow-editor');
        const fullscreenIcon = document.querySelector('#toggleFullscreen i');
        
        this.isFullscreen = !this.isFullscreen;
        
        editor?.classList.toggle('fullscreen', this.isFullscreen);
        if (fullscreenIcon) {
            fullscreenIcon.className = this.isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
        }
        document.body.style.overflow = this.isFullscreen ? 'hidden' : 'auto';
        
        this.updateCanvasLayout();
    }

    toggleCompactMode() {
        const toolbar = document.querySelector('.workflow-toolbar');
        const editor = document.querySelector('.workflow-editor');
        
        toolbar?.classList.toggle('compact');
        editor?.classList.toggle('compact-sidebar');
    }

    resetLayout() {
        const editor = document.querySelector('.workflow-editor');
        const sidebar = document.querySelector('.workflow-sidebar');
        const properties = document.querySelector('.node-properties');
        const toolbar = document.querySelector('.workflow-toolbar');
        
        this.isFullscreen = false;
        this.sidebarCollapsed = false;
        this.propertiesCollapsed = false;
        
        editor?.classList.remove('fullscreen', 'sidebar-collapsed', 'properties-collapsed', 'both-collapsed', 'compact-sidebar');
        sidebar?.classList.remove('collapsed');
        properties?.classList.remove('collapsed', 'expanded');
        toolbar?.classList.remove('compact');
        
        document.body.style.overflow = 'auto';
        const fullscreenIcon = document.querySelector('#toggleFullscreen i');
        if (fullscreenIcon) fullscreenIcon.className = 'fas fa-expand';
        
        this.updateCanvasLayout();
    }

    updateCanvasLayout() {
        const editor = document.querySelector('.workflow-editor');
        editor?.classList.toggle('both-collapsed', this.sidebarCollapsed && this.propertiesCollapsed);
        
        if (window.workflowEditor) {
            setTimeout(() => workflowEditor.updateAllConnections(), 300);
        }
        if (window.editWorkflowEditor) {
            setTimeout(() => editWorkflowEditor.updateAllConnections(), 300);
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'F11') {
                e.preventDefault();
                this.toggleFullscreen();
            } else if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'm': e.preventDefault(); this.toggleCompactMode(); break;
                    case 'r': e.preventDefault(); this.resetLayout(); break;
                    case '[': e.preventDefault(); this.toggleSidebar(); break;
                    case ']': e.preventDefault(); this.toggleProperties(); break;
                }
            }
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupFlashMessages();
    
    // Load workflow previews for existing scenarios
    document.querySelectorAll('[id^="nodeCount"]').forEach(element => {
        const scenarioId = element.id.replace('nodeCount', '');
        if (scenarioId && window[`scenario_${scenarioId}_data`]) {
            loadWorkflowPreview(scenarioId, window[`scenario_${scenarioId}_data`]);
        }
    });
});

// Enhanced Error Handling
window.addEventListener('error', function(e) {
    console.error('🚨 Enhanced Workflow Editor Error:', e.error);
});

// Enhanced Performance Monitoring
if ('performance' in window) {
    window.addEventListener('load', function() {
        setTimeout(function() {
            const perfData = performance.getEntriesByType('navigation')[0];
            const loadTime = Math.round(perfData.loadEventEnd - perfData.loadEventStart);
            console.log(`🚀 Enhanced Editor loaded in ${loadTime}ms`);
            
            if (loadTime > 1000) {
                console.warn('⚠️ Slow loading detected. Consider optimizing resources.');
            }
        }, 0);
    });
}
