import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import powerbi from "powerbi-visuals-api";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/**
 * Table display settings
 */
class TableSettingsCard extends FormattingSettingsCard {
    rowHeight = new formattingSettings.NumUpDown({
        name: "rowHeight",
        displayName: "Row Height",
        value: 36,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 24 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 80 }
        }
    });

    headerHeight = new formattingSettings.NumUpDown({
        name: "headerHeight",
        displayName: "Header Height",
        value: 40,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 28 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 80 }
        }
    });

    headerFontSize = new formattingSettings.NumUpDown({
        name: "headerFontSize",
        displayName: "Header Font Size",
        value: 12,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 20 }
        }
    });

    bodyFontSize = new formattingSettings.NumUpDown({
        name: "bodyFontSize",
        displayName: "Body Font Size",
        value: 11,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 18 }
        }
    });

    rowColor1 = new formattingSettings.ColorPicker({
        name: "rowColor1",
        displayName: "Row Color (Odd)",
        value: { value: "#FFFFFF" }
    });

    rowColor2 = new formattingSettings.ColorPicker({
        name: "rowColor2",
        displayName: "Row Color (Even)",
        value: { value: "#F9F9F9" }
    });

    headerBackgroundColor = new formattingSettings.ColorPicker({
        name: "headerBackgroundColor",
        displayName: "Header Background Color",
        value: { value: "#4472C4" }
    });

    headerFontColor = new formattingSettings.ColorPicker({
        name: "headerFontColor",
        displayName: "Header Font Color",
        value: { value: "#FFFFFF" }
    });

    borderColor = new formattingSettings.ColorPicker({
        name: "borderColor",
        displayName: "Border Color",
        value: { value: "#E0E0E0" }
    });

    cellPadding = new formattingSettings.NumUpDown({
        name: "cellPadding",
        displayName: "Cell Padding",
        value: 8,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 2 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 20 }
        }
    });

    textColumnWidth = new formattingSettings.NumUpDown({
        name: "textColumnWidth",
        displayName: "Text Column Width",
        value: 150,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 60 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 400 }
        }
    });

    name: string = "tableSettings";
    displayName: string = "Table Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.rowHeight,
        this.headerHeight,
        this.headerFontSize,
        this.bodyFontSize,
        this.cellPadding,
        this.textColumnWidth,
        this.rowColor1,
        this.rowColor2,
        this.headerBackgroundColor,
        this.headerFontColor,
        this.borderColor
    ];
}

/**
 * RAG Status circle settings
 */
class StatusSettingsCard extends FormattingSettingsCard {
    redColor = new formattingSettings.ColorPicker({
        name: "redColor",
        displayName: "Red Color",
        value: { value: "#DC3545" }
    });

    amberColor = new formattingSettings.ColorPicker({
        name: "amberColor",
        displayName: "Amber Color",
        value: { value: "#FFC107" }
    });

    greenColor = new formattingSettings.ColorPicker({
        name: "greenColor",
        displayName: "Green Color",
        value: { value: "#28A745" }
    });

    circleSize = new formattingSettings.NumUpDown({
        name: "circleSize",
        displayName: "Circle Size",
        value: 14,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 24 }
        }
    });

    columnWidth = new formattingSettings.NumUpDown({
        name: "columnWidth",
        displayName: "Status Column Width",
        value: 60,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 30 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 150 }
        }
    });

    name: string = "statusSettings";
    displayName: string = "Status Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.redColor,
        this.amberColor,
        this.greenColor,
        this.circleSize,
        this.columnWidth
    ];
}

/**
 * Budget waterfall chart settings
 */
class BudgetChartSettingsCard extends FormattingSettingsCard {
    chartWidth = new formattingSettings.NumUpDown({
        name: "chartWidth",
        displayName: "Chart Width",
        value: 200,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 120 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 400 }
        }
    });

    planColor = new formattingSettings.ColorPicker({
        name: "planColor",
        displayName: "Plan Bar Color",
        value: { value: "#4472C4" }
    });

    forecastColor = new formattingSettings.ColorPicker({
        name: "forecastColor",
        displayName: "Forecast Bar Color",
        value: { value: "#6A9FD6" }
    });

    actualColor = new formattingSettings.ColorPicker({
        name: "actualColor",
        displayName: "Actual Bar Color",
        value: { value: "#2B5797" }
    });

    increaseColor = new formattingSettings.ColorPicker({
        name: "increaseColor",
        displayName: "Increase (Bridge) Color",
        value: { value: "#28A745" }
    });

    decreaseColor = new formattingSettings.ColorPicker({
        name: "decreaseColor",
        displayName: "Decrease (Bridge) Color",
        value: { value: "#DC3545" }
    });

    showValues = new formattingSettings.ToggleSwitch({
        name: "showValues",
        displayName: "Show Values on Bars",
        value: true
    });

    valueFontSize = new formattingSettings.NumUpDown({
        name: "valueFontSize",
        displayName: "Value Font Size",
        value: 9,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 7 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 14 }
        }
    });

    name: string = "budgetChartSettings";
    displayName: string = "Budget Chart Settings";
    slices: Array<FormattingSettingsSlice> = [
        this.chartWidth,
        this.planColor,
        this.forecastColor,
        this.actualColor,
        this.increaseColor,
        this.decreaseColor,
        this.showValues,
        this.valueFontSize
    ];
}

/**
 * Visual formatting settings model
 */
export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    tableSettings = new TableSettingsCard();
    statusSettings = new StatusSettingsCard();
    budgetChartSettings = new BudgetChartSettingsCard();
    cards = [this.tableSettings, this.statusSettings, this.budgetChartSettings];
}
