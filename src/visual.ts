import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { VisualFormattingSettingsModel } from "./settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataView = powerbi.DataView;

import "../style/visual.less";

// --- Interfaces ---

interface ColumnInfo {
    index: number;
    displayName: string;
    role: "columns" | "status" | "budgetPlan" | "budgetForecast" | "budgetActual";
}

interface TableRowData {
    textValues: { columnName: string; value: string }[];
    status: string | null;
    budgetPlan: number | null;
    budgetForecast: number | null;
    budgetActual: number | null;
}

interface SortState {
    columnIndex: number;
    ascending: boolean;
}

// --- Visual Class ---

export class Visual implements IVisual {
    private target: HTMLElement;
    private tableContainer: HTMLDivElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private columnInfos: ColumnInfo[];
    private tableData: TableRowData[];
    private sortState: SortState | null;
    private columnWidths: Map<number, number>;
    private userResizedColumns: Set<number>;
    private isResizing: boolean;
    private measureCanvas: HTMLCanvasElement;

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.target = options.element;
        this.sortState = null;
        this.columnInfos = [];
        this.tableData = [];
        this.columnWidths = new Map();
        this.userResizedColumns = new Set();
        this.isResizing = false;
        this.measureCanvas = document.createElement("canvas");

        this.tableContainer = document.createElement("div");
        this.tableContainer.className = "table-visual-container";
        this.target.appendChild(this.tableContainer);
    }

    public update(options: VisualUpdateOptions): void {
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            options.dataViews[0]
        );

        const dataView = options.dataViews?.[0];
        if (!dataView || !dataView.table || !dataView.table.rows || dataView.table.rows.length === 0) {
            this.columnInfos = [];
            this.tableData = [];
            this.renderEmptyState(options.viewport.width, options.viewport.height);
            return;
        }

        this.columnInfos = this.parseColumnInfos(dataView);
        this.tableData = this.transformData(dataView, this.columnInfos);

        if (this.sortState !== null) {
            this.applySorting();
        }

        this.tableContainer.style.width = options.viewport.width + "px";
        this.tableContainer.style.height = options.viewport.height + "px";

        // Apply dynamic CSS custom properties
        const cellPad = this.formattingSettings.tableSettings.cellPadding.value;
        this.tableContainer.style.setProperty("--cell-padding", cellPad + "px");

        this.renderTable();
    }

    // --- Data Parsing ---

    private parseColumnInfos(dataView: DataView): ColumnInfo[] {
        if (!dataView || !dataView.table || !dataView.table.columns) {
            return [];
        }

        const infos: ColumnInfo[] = [];
        const columns = dataView.table.columns;

        columns.forEach((col, index) => {
            if (!col.roles) return;

            let role: ColumnInfo["role"] | null = null;
            if (col.roles["columns"]) role = "columns";
            else if (col.roles["status"]) role = "status";
            else if (col.roles["budgetPlan"]) role = "budgetPlan";
            else if (col.roles["budgetForecast"]) role = "budgetForecast";
            else if (col.roles["budgetActual"]) role = "budgetActual";

            if (role) {
                infos.push({
                    index,
                    displayName: col.displayName || `Column ${index}`,
                    role
                });
            }
        });

        return infos;
    }

    private transformData(dataView: DataView, columnInfos: ColumnInfo[]): TableRowData[] {
        if (!dataView || !dataView.table || !dataView.table.rows || dataView.table.rows.length === 0) {
            return [];
        }

        const rows = dataView.table.rows;
        const textColumnInfos = columnInfos.filter(c => c.role === "columns");
        const statusInfo = columnInfos.find(c => c.role === "status");
        const planInfo = columnInfos.find(c => c.role === "budgetPlan");
        const forecastInfo = columnInfos.find(c => c.role === "budgetForecast");
        const actualInfo = columnInfos.find(c => c.role === "budgetActual");

        const result: TableRowData[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            const textValues = textColumnInfos.map(ci => ({
                columnName: ci.displayName,
                value: row[ci.index] != null ? row[ci.index].toString() : ""
            }));

            const status = statusInfo && row[statusInfo.index] != null
                ? row[statusInfo.index].toString()
                : null;

            const budgetPlan = planInfo && row[planInfo.index] != null
                ? Number(row[planInfo.index])
                : null;

            const budgetForecast = forecastInfo && row[forecastInfo.index] != null
                ? Number(row[forecastInfo.index])
                : null;

            const budgetActual = actualInfo && row[actualInfo.index] != null
                ? Number(row[actualInfo.index])
                : null;

            result.push({ textValues, status, budgetPlan, budgetForecast, budgetActual });
        }

        return result;
    }

    // --- Column Auto-Sizing ---

    private measureTextWidth(text: string, font: string): number {
        const ctx = this.measureCanvas.getContext("2d");
        if (!ctx) return text.length * 7;
        ctx.font = font;
        return ctx.measureText(text).width;
    }

    private computeAutoColumnWidths(): void {
        const settings = this.formattingSettings.tableSettings;
        const padding = settings.cellPadding.value * 2 + 8; // left+right padding + margin
        const headerFont = `600 ${settings.headerFontSize.value}px "Segoe UI", sans-serif`;
        const bodyFont = `${settings.bodyFontSize.value}px "Segoe UI", sans-serif`;

        const hasStatus = this.columnInfos.some(c => c.role === "status");
        const hasBudget = this.columnInfos.some(c =>
            c.role === "budgetPlan" || c.role === "budgetForecast" || c.role === "budgetActual"
        );
        const textColumns = this.columnInfos.filter(c => c.role === "columns");

        let logicalIndex = 0;

        // Status column: size based on header text + circle
        if (hasStatus) {
            if (!this.userResizedColumns.has(logicalIndex)) {
                const statusCol = this.columnInfos.find(c => c.role === "status");
                const headerName = statusCol ? statusCol.displayName : "Status";
                const headerW = this.measureTextWidth(headerName + " ▼", headerFont) + padding;
                const circleW = this.formattingSettings.statusSettings.circleSize.value + padding;
                this.columnWidths.set(logicalIndex, Math.max(headerW, circleW, 40));
            }
            logicalIndex++;
        }

        // Text columns: size based on header + content
        textColumns.forEach(col => {
            if (!this.userResizedColumns.has(logicalIndex)) {
                const headerW = this.measureTextWidth(col.displayName + " ▼", headerFont) + padding;

                // Measure content: sample all rows, find the longest
                let maxContentW = 0;
                for (const row of this.tableData) {
                    const textIdx = logicalIndex - (hasStatus ? 1 : 0);
                    const val = row.textValues[textIdx]?.value || "";
                    if (val.length > 0) {
                        const w = this.measureTextWidth(val, bodyFont) + padding;
                        if (w > maxContentW) maxContentW = w;
                    }
                }

                // Clamp: min 60px, max 400px
                const autoW = Math.min(400, Math.max(60, headerW, maxContentW));
                this.columnWidths.set(logicalIndex, autoW);
            }
            logicalIndex++;
        });

        // Budget column: use chartWidth setting
        if (hasBudget) {
            if (!this.userResizedColumns.has(logicalIndex)) {
                const budgetW = this.formattingSettings.budgetChartSettings.chartWidth.value;
                this.columnWidths.set(logicalIndex, budgetW);
            }
            logicalIndex++;
        }
    }

    // --- Column Resize ---

    private getColumnWidth(logicalIndex: number, defaultWidth: number): number {
        return this.columnWidths.get(logicalIndex) || defaultWidth;
    }

    private addResizeHandle(th: HTMLTableCellElement, logicalIndex: number): void {
        const handle = document.createElement("div");
        handle.className = "col-resize-handle";

        // Inline styles as fallback to ensure resize always works
        handle.style.position = "absolute";
        handle.style.right = "-3px";
        handle.style.top = "0";
        handle.style.bottom = "0";
        handle.style.width = "7px";
        handle.style.cursor = "col-resize";
        handle.style.zIndex = "10";
        handle.style.background = "transparent";

        handle.addEventListener("mousedown", (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            this.isResizing = true;

            const startX = e.clientX;
            const startWidth = th.offsetWidth;
            handle.style.background = "rgba(255,255,255,0.5)";

            const onMouseMove = (moveEvent: MouseEvent) => {
                moveEvent.preventDefault();
                const diff = moveEvent.clientX - startX;
                const newWidth = Math.max(30, startWidth + diff);
                this.columnWidths.set(logicalIndex, newWidth);
                th.style.width = newWidth + "px";
                th.style.minWidth = newWidth + "px";

                // Update matching body cells
                const table = th.closest("table");
                if (table) {
                    const colIndex = Array.from(th.parentElement!.children).indexOf(th);
                    const tbody = table.querySelector("tbody");
                    if (tbody) {
                        tbody.querySelectorAll("tr").forEach(row => {
                            const td = row.children[colIndex] as HTMLTableCellElement;
                            if (td) {
                                td.style.width = newWidth + "px";
                                td.style.minWidth = newWidth + "px";
                            }
                        });
                    }
                }
            };

            const onMouseUp = () => {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
                handle.style.background = "transparent";
                this.userResizedColumns.add(logicalIndex);
                setTimeout(() => { this.isResizing = false; }, 50);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        // Ensure th can contain absolute-positioned children
        th.style.position = "relative";
        th.style.overflow = "visible";
        th.appendChild(handle);
    }

    // --- Sorting ---

    private onHeaderClick(columnIndex: number): void {
        if (this.isResizing) return;
        if (this.sortState && this.sortState.columnIndex === columnIndex) {
            this.sortState.ascending = !this.sortState.ascending;
        } else {
            this.sortState = { columnIndex, ascending: true };
        }
        this.applySorting();
        this.renderTable();
    }

    private applySorting(): void {
        if (!this.sortState) return;

        const idx = this.sortState.columnIndex;
        const asc = this.sortState.ascending;
        const hasStatus = this.columnInfos.some(c => c.role === "status");
        const textColumnCount = this.tableData.length > 0 ? this.tableData[0].textValues.length : 0;

        // Ordre des colonnes: Status (si present) | Text columns | Budget
        const statusOffset = hasStatus ? 1 : 0;

        this.tableData.sort((a, b) => {
            let valA: string | number | null;
            let valB: string | number | null;

            if (hasStatus && idx === 0) {
                // Tri par statut
                valA = a.status || "";
                valB = b.status || "";
            } else if (idx - statusOffset < textColumnCount) {
                // Tri par colonne texte
                const textIdx = idx - statusOffset;
                valA = a.textValues[textIdx]?.value || "";
                valB = b.textValues[textIdx]?.value || "";
            } else {
                // Tri par budget (plan par defaut)
                valA = a.budgetPlan || 0;
                valB = b.budgetPlan || 0;
            }

            let comparison: number;
            if (typeof valA === "number" && typeof valB === "number") {
                comparison = valA - valB;
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }

            return asc ? comparison : -comparison;
        });
    }

    // --- Table Rendering ---

    private renderTable(): void {
        while (this.tableContainer.firstChild) {
            this.tableContainer.removeChild(this.tableContainer.firstChild);
        }

        // Auto-compute column widths based on content
        this.computeAutoColumnWidths();

        const hasStatus = this.columnInfos.some(c => c.role === "status");
        const hasBudget = this.columnInfos.some(c =>
            c.role === "budgetPlan" || c.role === "budgetForecast" || c.role === "budgetActual"
        );

        const table = document.createElement("table");
        table.className = "table-visual";

        this.renderTableHeader(table, hasStatus, hasBudget);
        this.renderTableBody(table, hasStatus, hasBudget);

        this.tableContainer.appendChild(table);
    }

    private renderTableHeader(table: HTMLTableElement, hasStatus: boolean, hasBudget: boolean): void {
        const settings = this.formattingSettings.tableSettings;
        const thead = document.createElement("thead");
        const tr = document.createElement("tr");

        const textColumns = this.columnInfos.filter(c => c.role === "columns");
        let logicalIndex = 0;

        // Status header (EN PREMIER)
        if (hasStatus) {
            const th = document.createElement("th");
            const statusCol = this.columnInfos.find(c => c.role === "status");
            const statusDefaultW = this.formattingSettings.statusSettings.columnWidth.value;
            const statusW = this.getColumnWidth(logicalIndex, statusDefaultW);

            const headerText = document.createElement("span");
            headerText.textContent = statusCol ? statusCol.displayName : "Status";
            if (this.sortState && this.sortState.columnIndex === logicalIndex) {
                headerText.textContent += this.sortState.ascending ? " ▲" : " ▼";
            }
            th.appendChild(headerText);

            th.style.height = settings.headerHeight.value + "px";
            th.style.fontSize = settings.headerFontSize.value + "px";
            th.style.backgroundColor = settings.headerBackgroundColor.value.value;
            th.style.color = settings.headerFontColor.value.value;
            th.style.textAlign = "center";
            th.style.cursor = "pointer";
            th.className = "sortable-header";
            th.style.width = statusW + "px";
            th.style.minWidth = statusW + "px";

            const sortIdx = logicalIndex;
            th.addEventListener("click", () => this.onHeaderClick(sortIdx));
            this.addResizeHandle(th, logicalIndex);
            tr.appendChild(th);
            logicalIndex++;
        }

        // Text column headers
        const textDefaultW = settings.textColumnWidth.value;
        textColumns.forEach(col => {
            const th = document.createElement("th");
            const colW = this.getColumnWidth(logicalIndex, textDefaultW);

            const headerText = document.createElement("span");
            headerText.textContent = col.displayName;
            if (this.sortState && this.sortState.columnIndex === logicalIndex) {
                headerText.textContent += this.sortState.ascending ? " ▲" : " ▼";
            }
            th.appendChild(headerText);

            th.style.height = settings.headerHeight.value + "px";
            th.style.fontSize = settings.headerFontSize.value + "px";
            th.style.backgroundColor = settings.headerBackgroundColor.value.value;
            th.style.color = settings.headerFontColor.value.value;
            th.style.cursor = "pointer";
            th.className = "sortable-header";
            th.style.width = colW + "px";
            th.style.minWidth = colW + "px";

            const sortIdx = logicalIndex;
            th.addEventListener("click", () => this.onHeaderClick(sortIdx));
            this.addResizeHandle(th, logicalIndex);

            tr.appendChild(th);
            logicalIndex++;
        });

        // Budget waterfall header
        if (hasBudget) {
            const th = document.createElement("th");
            const budgetDefaultW = this.formattingSettings.budgetChartSettings.chartWidth.value;
            const budgetW = this.getColumnWidth(logicalIndex, budgetDefaultW);

            th.style.height = settings.headerHeight.value + "px";
            th.style.fontSize = settings.headerFontSize.value + "px";
            th.style.backgroundColor = settings.headerBackgroundColor.value.value;
            th.style.color = settings.headerFontColor.value.value;
            th.style.textAlign = "center";
            th.style.width = budgetW + "px";
            th.style.minWidth = budgetW + "px";
            th.style.padding = "2px 4px";
            th.style.lineHeight = "1.2";

            // Title
            const titleDiv = document.createElement("div");
            titleDiv.textContent = "Budget";
            titleDiv.style.fontWeight = "600";
            titleDiv.style.marginBottom = "2px";
            th.appendChild(titleDiv);

            // Legend
            const legendDiv = document.createElement("div");
            legendDiv.style.display = "flex";
            legendDiv.style.justifyContent = "center";
            legendDiv.style.gap = "8px";
            legendDiv.style.fontSize = (settings.headerFontSize.value - 2) + "px";
            legendDiv.style.fontWeight = "400";
            legendDiv.style.opacity = "0.85";

            const chartSettings = this.formattingSettings.budgetChartSettings;
            const legendItems: { label: string; color: string }[] = [
                { label: "Plan", color: chartSettings.planColor.value.value },
                { label: "Forecast", color: chartSettings.forecastColor.value.value },
                { label: "Actual", color: chartSettings.actualColor.value.value }
            ];

            legendItems.forEach(item => {
                const span = document.createElement("span");
                span.style.display = "inline-flex";
                span.style.alignItems = "center";
                span.style.gap = "3px";

                const dot = document.createElement("span");
                dot.style.width = "8px";
                dot.style.height = "8px";
                dot.style.borderRadius = "2px";
                dot.style.backgroundColor = item.color;
                dot.style.display = "inline-block";
                dot.style.flexShrink = "0";

                const label = document.createElement("span");
                label.textContent = item.label;

                span.appendChild(dot);
                span.appendChild(label);
                legendDiv.appendChild(span);
            });

            th.appendChild(legendDiv);
            this.addResizeHandle(th, logicalIndex);
            tr.appendChild(th);
            logicalIndex++;
        }

        thead.appendChild(tr);
        table.appendChild(thead);
    }

    private renderTableBody(table: HTMLTableElement, hasStatus: boolean, hasBudget: boolean): void {
        const settings = this.formattingSettings.tableSettings;
        const tbody = document.createElement("tbody");

        // Compute column index offsets for width lookup
        const statusDefaultW = this.formattingSettings.statusSettings.columnWidth.value;
        const textDefaultW = settings.textColumnWidth.value;
        const budgetDefaultW = this.formattingSettings.budgetChartSettings.chartWidth.value;

        this.tableData.forEach((row, rowIndex) => {
            const tr = document.createElement("tr");
            const bgColor = rowIndex % 2 === 0
                ? settings.rowColor1.value.value
                : settings.rowColor2.value.value;
            tr.style.backgroundColor = bgColor;

            let colIdx = 0;

            // Status cell (EN PREMIER)
            if (hasStatus) {
                const statusW = this.getColumnWidth(colIdx, statusDefaultW);
                const td = document.createElement("td");
                td.style.textAlign = "center";
                td.style.verticalAlign = "middle";
                td.style.height = settings.rowHeight.value + "px";
                td.style.width = statusW + "px";
                td.style.minWidth = statusW + "px";
                td.style.borderBottom = `1px solid ${settings.borderColor.value.value}`;
                const svg = this.createStatusCircle(row.status || "");
                td.appendChild(svg);
                tr.appendChild(td);
                colIdx++;
            }

            // Text cells
            row.textValues.forEach(tv => {
                const textW = this.getColumnWidth(colIdx, textDefaultW);
                const td = document.createElement("td");
                td.textContent = tv.value;
                td.style.minHeight = settings.rowHeight.value + "px";
                td.style.fontSize = settings.bodyFontSize.value + "px";
                td.style.borderBottom = `1px solid ${settings.borderColor.value.value}`;
                td.style.width = textW + "px";
                td.style.minWidth = textW + "px";
                tr.appendChild(td);
                colIdx++;
            });

            // Budget waterfall cell
            if (hasBudget) {
                const budgetW = this.getColumnWidth(colIdx, budgetDefaultW);
                const td = document.createElement("td");
                td.style.textAlign = "center";
                td.style.verticalAlign = "middle";
                td.style.height = settings.rowHeight.value + "px";
                td.style.borderBottom = `1px solid ${settings.borderColor.value.value}`;
                td.style.padding = "2px 4px";
                td.style.width = budgetW + "px";
                td.style.minWidth = budgetW + "px";

                if (row.budgetPlan !== null || row.budgetForecast !== null || row.budgetActual !== null) {
                    const svg = this.createWaterfallChart(
                        row.budgetPlan || 0,
                        row.budgetForecast || 0,
                        row.budgetActual || 0
                    );
                    td.appendChild(svg);
                }
                tr.appendChild(td);
            }

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
    }

    // --- Status Cell ---

    private createStatusCircle(status: string): SVGSVGElement {
        const settings = this.formattingSettings.statusSettings;
        const size = settings.circleSize.value;
        const svgNS = "http://www.w3.org/2000/svg";

        const svg = document.createElementNS(svgNS, "svg") as SVGSVGElement;
        svg.setAttribute("width", String(size + 4));
        svg.setAttribute("height", String(size + 4));
        svg.setAttribute("viewBox", `0 0 ${size + 4} ${size + 4}`);
        svg.style.verticalAlign = "middle";

        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", String((size + 4) / 2));
        circle.setAttribute("cy", String((size + 4) / 2));
        circle.setAttribute("r", String(size / 2));
        circle.setAttribute("fill", this.getStatusColor(status));

        svg.appendChild(circle);
        return svg;
    }

    private getStatusColor(status: string): string {
        const s = status.toLowerCase().trim();
        const settings = this.formattingSettings.statusSettings;

        if (s.includes("red") || s.includes("rouge")) {
            return settings.redColor.value.value;
        } else if (s.includes("amber") || s.includes("ambre") || s.includes("orange")) {
            return settings.amberColor.value.value;
        } else if (s.includes("green") || s.includes("vert")) {
            return settings.greenColor.value.value;
        }
        return "#999999";
    }

    // --- Waterfall Chart ---

    private createWaterfallChart(plan: number, forecast: number, actual: number): SVGSVGElement {
        const chartSettings = this.formattingSettings.budgetChartSettings;
        const tableSettings = this.formattingSettings.tableSettings;

        const chartWidth = chartSettings.chartWidth.value;
        const chartHeight = tableSettings.rowHeight.value - 4;
        const margin = { top: 16, right: 4, bottom: 2, left: 4 };
        const innerWidth = chartWidth - margin.left - margin.right;
        const innerHeight = chartHeight - margin.top - margin.bottom;

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg") as SVGSVGElement;
        svg.setAttribute("width", String(chartWidth));
        svg.setAttribute("height", String(chartHeight));
        svg.setAttribute("viewBox", `0 0 ${chartWidth} ${chartHeight}`);
        svg.style.display = "block";

        const maxVal = Math.max(plan, forecast, actual, 1);

        const yScale = (value: number): number => {
            return margin.top + innerHeight * (1 - value / maxVal);
        };
        const barPixelHeight = (value: number): number => {
            return (value / maxVal) * innerHeight;
        };

        const slotWidth = innerWidth / 5;
        const barWidth = slotWidth * 0.65;
        const bridgeWidth = slotWidth * 0.35;

        const slotCenterX = (slotIndex: number): number => {
            return margin.left + slotIndex * slotWidth + slotWidth / 2;
        };

        const baselineY = margin.top + innerHeight;

        // Baseline
        const baseline = document.createElementNS(svgNS, "line");
        baseline.setAttribute("x1", String(margin.left));
        baseline.setAttribute("x2", String(chartWidth - margin.right));
        baseline.setAttribute("y1", String(baselineY));
        baseline.setAttribute("y2", String(baselineY));
        baseline.setAttribute("stroke", "#CCC");
        baseline.setAttribute("stroke-width", "1");
        svg.appendChild(baseline);

        // Helpers
        const createRect = (x: number, y: number, w: number, h: number, fill: string): SVGRectElement => {
            const rect = document.createElementNS(svgNS, "rect");
            rect.setAttribute("x", String(x));
            rect.setAttribute("y", String(y));
            rect.setAttribute("width", String(w));
            rect.setAttribute("height", String(Math.max(h, 1)));
            rect.setAttribute("fill", fill);
            rect.setAttribute("rx", "1");
            return rect;
        };

        const createLabel = (x: number, y: number, text: string, fontSize: number): SVGTextElement => {
            const el = document.createElementNS(svgNS, "text");
            el.setAttribute("x", String(x));
            el.setAttribute("y", String(y));
            el.setAttribute("text-anchor", "middle");
            el.setAttribute("font-size", String(fontSize));
            el.setAttribute("fill", "#333");
            el.setAttribute("font-family", "Segoe UI, sans-serif");
            el.textContent = text;
            return el;
        };

        const createConnector = (x1: number, x2: number, y: number): SVGLineElement => {
            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("x1", String(x1));
            line.setAttribute("x2", String(x2));
            line.setAttribute("y1", String(y));
            line.setAttribute("y2", String(y));
            line.setAttribute("stroke", "#999");
            line.setAttribute("stroke-width", "1");
            line.setAttribute("stroke-dasharray", "2,2");
            return line;
        };

        const showValues = chartSettings.showValues.value;
        const valueFontSize = chartSettings.valueFontSize.value;

        // === Bar 1: Plan (slot 0) ===
        const planBarX = slotCenterX(0) - barWidth / 2;
        const planBarY = yScale(plan);
        const planBarH = barPixelHeight(plan);
        svg.appendChild(createRect(planBarX, planBarY, barWidth, planBarH, chartSettings.planColor.value.value));

        if (showValues) {
            svg.appendChild(createLabel(
                slotCenterX(0), planBarY - 2, this.formatBudgetValue(plan), valueFontSize
            ));
        }

        // === Bridge 1: Plan -> Forecast (slot 1) ===
        const delta1 = forecast - plan;
        const bridge1X = slotCenterX(1) - bridgeWidth / 2;
        let bridge1Y: number;
        let bridge1H: number;
        let bridge1Color: string;

        if (delta1 >= 0) {
            bridge1Y = yScale(forecast);
            bridge1H = barPixelHeight(forecast) - barPixelHeight(plan);
            bridge1Color = chartSettings.increaseColor.value.value;
        } else {
            bridge1Y = yScale(plan);
            bridge1H = barPixelHeight(plan) - barPixelHeight(forecast);
            bridge1Color = chartSettings.decreaseColor.value.value;
        }

        svg.appendChild(createRect(bridge1X, bridge1Y, bridgeWidth, Math.abs(bridge1H), bridge1Color));

        // Delta label on Bridge 1
        if (showValues && delta1 !== 0) {
            const deltaLabel = (delta1 > 0 ? "+" : "") + this.formatBudgetValue(delta1);
            const deltaLabelY = bridge1Y - 2;
            const deltaEl = document.createElementNS(svgNS, "text");
            deltaEl.setAttribute("x", String(slotCenterX(1)));
            deltaEl.setAttribute("y", String(deltaLabelY));
            deltaEl.setAttribute("text-anchor", "middle");
            deltaEl.setAttribute("font-size", String(valueFontSize));
            deltaEl.setAttribute("fill", bridge1Color);
            deltaEl.setAttribute("font-family", "Segoe UI, sans-serif");
            deltaEl.setAttribute("font-weight", "600");
            deltaEl.textContent = deltaLabel;
            svg.appendChild(deltaEl);
        }

        // Connector Plan -> Bridge 1
        const planTopY = yScale(plan);
        svg.appendChild(createConnector(slotCenterX(0) + barWidth / 2, bridge1X, planTopY));

        // Connector Bridge 1 -> Forecast
        const forecastTopY = yScale(forecast);
        svg.appendChild(createConnector(bridge1X + bridgeWidth, slotCenterX(2) - barWidth / 2, forecastTopY));

        // === Bar 2: Forecast (slot 2) ===
        const forecastBarX = slotCenterX(2) - barWidth / 2;
        const forecastBarY = yScale(forecast);
        const forecastBarH = barPixelHeight(forecast);
        svg.appendChild(createRect(forecastBarX, forecastBarY, barWidth, forecastBarH, chartSettings.forecastColor.value.value));

        if (showValues) {
            svg.appendChild(createLabel(
                slotCenterX(2), forecastBarY - 2, this.formatBudgetValue(forecast), valueFontSize
            ));
        }

        // === Bridge 2: Forecast -> Actual (slot 3) ===
        const delta2 = actual - forecast;
        const bridge2X = slotCenterX(3) - bridgeWidth / 2;
        let bridge2Y: number;
        let bridge2H: number;
        let bridge2Color: string;

        if (delta2 >= 0) {
            bridge2Y = yScale(actual);
            bridge2H = barPixelHeight(actual) - barPixelHeight(forecast);
            bridge2Color = chartSettings.increaseColor.value.value;
        } else {
            bridge2Y = yScale(forecast);
            bridge2H = barPixelHeight(forecast) - barPixelHeight(actual);
            bridge2Color = chartSettings.decreaseColor.value.value;
        }

        svg.appendChild(createRect(bridge2X, bridge2Y, bridgeWidth, Math.abs(bridge2H), bridge2Color));

        // Delta label on Bridge 2
        if (showValues && delta2 !== 0) {
            const deltaLabel2 = (delta2 > 0 ? "+" : "") + this.formatBudgetValue(delta2);
            const deltaLabel2Y = bridge2Y - 2;
            const deltaEl2 = document.createElementNS(svgNS, "text");
            deltaEl2.setAttribute("x", String(slotCenterX(3)));
            deltaEl2.setAttribute("y", String(deltaLabel2Y));
            deltaEl2.setAttribute("text-anchor", "middle");
            deltaEl2.setAttribute("font-size", String(valueFontSize));
            deltaEl2.setAttribute("fill", bridge2Color);
            deltaEl2.setAttribute("font-family", "Segoe UI, sans-serif");
            deltaEl2.setAttribute("font-weight", "600");
            deltaEl2.textContent = deltaLabel2;
            svg.appendChild(deltaEl2);
        }

        // Connector Forecast -> Bridge 2
        svg.appendChild(createConnector(slotCenterX(2) + barWidth / 2, bridge2X, forecastTopY));

        // Connector Bridge 2 -> Actual
        const actualTopY = yScale(actual);
        svg.appendChild(createConnector(bridge2X + bridgeWidth, slotCenterX(4) - barWidth / 2, actualTopY));

        // === Bar 3: Actual (slot 4) ===
        const actualBarX = slotCenterX(4) - barWidth / 2;
        const actualBarY = yScale(actual);
        const actualBarH = barPixelHeight(actual);
        svg.appendChild(createRect(actualBarX, actualBarY, barWidth, actualBarH, chartSettings.actualColor.value.value));

        if (showValues) {
            svg.appendChild(createLabel(
                slotCenterX(4), actualBarY - 2, this.formatBudgetValue(actual), valueFontSize
            ));
        }

        // Tooltip
        const title = document.createElementNS(svgNS, "title");
        title.textContent = `Plan: ${this.formatBudgetValue(plan)}\nForecast: ${this.formatBudgetValue(forecast)}\nActual: ${this.formatBudgetValue(actual)}`;
        svg.appendChild(title);

        return svg;
    }

    private formatBudgetValue(value: number): string {
        if (value === null || value === undefined) return "";
        if (value === 0) return "0";

        const abs = Math.abs(value);
        const sign = value < 0 ? "-" : "";

        if (abs >= 1000000000) {
            return sign + (abs / 1000000000).toFixed(1) + "B";
        } else if (abs >= 1000000) {
            const formatted = abs / 1000000;
            return sign + (formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)) + "M";
        } else if (abs >= 1000) {
            const formatted = abs / 1000;
            return sign + (formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)) + "K";
        }
        return value.toFixed(0);
    }

    // --- Empty State ---

    private renderEmptyState(width: number, height: number): void {
        while (this.tableContainer.firstChild) {
            this.tableContainer.removeChild(this.tableContainer.firstChild);
        }
        this.tableContainer.style.width = width + "px";
        this.tableContainer.style.height = height + "px";

        const emptyDiv = document.createElement("div");
        emptyDiv.className = "table-visual-empty";
        emptyDiv.textContent = "Add data to display the table";
        this.tableContainer.appendChild(emptyDiv);
    }

    // --- Formatting Pane ---

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
