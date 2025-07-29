"use strict";
import { libWrapper } from "./shim.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export var myCSSSheet = {};
export const modName = "Nameplate Ruler Scaling";
export const mod = "nameplate-ruler-hud-scaling";
export const DEFAULT_STYLE = {
    fontSize: 24,
};
export class StyleDefinition {
    constructor(fontSize, autoScale = false) {
        this.fontSize = fontSize;
        this.autoScale = autoScale;
    }
    static fromSetting(setting) {
        return new StyleDefinition(
            setting.fontSize,
            setting.autoScale
        );
    }
    toCanvasTextStyle() {
        return {
            fontSize: this.fontSize,
        };
    }
}
export const DEFAULT_STYLE_DEFINITION = new StyleDefinition(24);
export class CustomScaler {
    constructor(game, canvas, config, mergeObject) {
        this.game = game;
        this.canvas = canvas;
        this.CONFIG = config;
        this.mergeObject = mergeObject;
    }
    loadGlobalStyle() {
        const setting = this.game.settings.get(mod, "global-style");
        const style = StyleDefinition.fromSetting(setting);
        return style;
    }
    loadLocalStyles() {
        const settingBySceneId = this.game.settings.get(mod, "local-styles");
        let localStyles = new Map();
        for (const sceneId of Object.keys(settingBySceneId)) {
            localStyles.set(sceneId, StyleDefinition.fromSetting(settingBySceneId[sceneId]));
        }
        return localStyles;
    }
    getLocalStyle(sceneId) {
        return this.loadLocalStyles().get(sceneId);
    }
    async setLocalStyle(sceneId, styleDefinition) {
        let localStyles = this.loadLocalStyles();
        localStyles.set(sceneId, styleDefinition);
        await this.saveLocalStyles(Object.fromEntries(localStyles));
    }
    async saveLocalStyles(localStyles) {
        await game.settings.set("nameplate-ruler-hud-scaling", "local-styles", localStyles);
    }
    async saveGlobalStyle(globalStyle) {
        await game.settings.set("nameplate-ruler-hud-scaling", "global-style", globalStyle);
    }
    async deleteLocalStyle(sceneId) {
        let localStyles = this.loadLocalStyles();
        localStyles.delete(sceneId);
        await this.saveLocalStyles(localStyles);
    }
    isSceneBeingViewed() {
        return this.game.scenes?.viewed;
    }
    setCanvasStyle(myCSSSheet) {
        const globalStyle = this.loadGlobalStyle();
        const localStyles = this.loadLocalStyles();
        if (this.isSceneBeingViewed()) {
            if (localStyles.has(this.game.scenes.viewed.id)) {
                this.setCanvasStyleTo(localStyles.get(this.game.scenes.viewed.id),myCSSSheet);
            } else {
                this.setCanvasStyleTo(globalStyle,myCSSSheet);
            }
        }
        this.updateNameplatesOnCanvas(myCSSSheet);
    }
    setCanvasStyleTo(style,myCSSSheet) {
        if (style) {
            this.mergeObject(this.CONFIG.canvasTextStyle, style.toCanvasTextStyle());
            if(myCSSSheet) {
                myCSSSheet.cssRules[0].style.height = 0.8*style.fontSize + "px"
                myCSSSheet.cssRules[0].style.width = 0.8*style.fontSize + "px"
                myCSSSheet.cssRules[1].style.fontSize = style.fontSize + "px"
                myCSSSheet.cssRules[2].style.fontSize = style.fontSize + "px"
            }
        }
    }
    updateNameplatesOnCanvas(myCSSSheet) {
        if (this.isSceneBeingViewed()) {
            let resetScale = !this.isAutoScaleEnabledForScene(); 
            if (this.canvas.tokens) {
                for (let token of this.canvas.tokens.placeables) {
                    if (token.nameplate) {
                        this.mergeObject(token.nameplate.style, this.CONFIG.canvasTextStyle);
                        if(resetScale) 
                            token.nameplate.scale.set(this.canvas.dimensions.size / 100);
                    }
                }
            }
            if (this.canvas.templates) {
                for (let template of this.canvas.templates.placeables) {
                    if (template.ruler) {
                        this.mergeObject(template.ruler.style, this.CONFIG.canvasTextStyle);
                        if(resetScale) 
                            token.nameplate.scale.set(this.canvas.dimensions.size / 100);
                    }
                }
            }
            if (this.canvas.notes) {
                for (let note of this.canvas.notes.placeables) {
                    if (note.tooltip) {
                        this.mergeObject(note.tooltip.style, this.CONFIG.canvasTextStyle);
                        if(resetScale) 
                            token.nameplate.scale.set(this.canvas.dimensions.size / 100);
                    }
                }
            }
            if(myCSSSheet) {
                if(resetScale) 
                    myCSSSheet.cssRules[3].style.transform = "scale(var(--ui-scale)) translate(var(--transformX), var(--transformY))";
            }
        }
    }
    isAutoScaleEnabledForScene() {
        const localStyle = this.loadLocalStyles().get(this.game.scenes.viewed.id);
        const localAutoScale = localStyle?.autoScale;
        const globalAutoScale = this.loadGlobalStyle().autoScale;
        return localAutoScale || (globalAutoScale && !localStyle);
    }
    checkAutoScale(canvas, myCSSSheet) {
        if (canvas.tokens.preview.children.length > 0 || canvas.templates.preview.children.length > 0) return;
        if (this.isSceneBeingViewed()) {
            if (this.isAutoScaleEnabledForScene()) {
                let autoscalePrecalculate = CustomScaler._calculateAutoScale(100, canvas.stage.scale.x);
                CustomScaler._autoScaleTokenNameplates(canvas,autoscalePrecalculate);
                CustomScaler._autoScaleTemplateNameplates(canvas,autoscalePrecalculate);
                CustomScaler._autoScaleNotes(canvas,autoscalePrecalculate);
                CustomScaler._autoScaleRuler(myCSSSheet,autoscalePrecalculate);
            }
        }
    }
    static _autoScaleTokenNameplates(canvas,autoscalePrecalculate) {
        if (canvas.tokens) {
            for (let token of canvas.tokens.placeables) {
                if (token.nameplate) {
                    token.nameplate.scale.set(autoscalePrecalculate);
                }
            }
        }
    }
    static _autoScaleTemplateNameplates(canvas,autoscalePrecalculate) {
        if (canvas.templates) {
            for (let template of canvas.templates.placeables) {
                if (template.ruler) {
                    template.ruler.scale.set(autoscalePrecalculate);
                }
            }
        }
    }
    static _autoScaleNotes(canvas,autoscalePrecalculate) {
        if (canvas.notes) {
            for (let note of canvas.notes.placeables) {
                note.tooltip.scale.set(autoscalePrecalculate);
            }
        }
    }
    static _autoScaleRuler(myCSSSheet,autoscalePrecalculate) {
        if(myCSSSheet) {
                myCSSSheet.cssRules[3].style.transform = "scale(" + 0.7*autoscalePrecalculate + ") translate(var(--transformX), var(--transformY)";
        }
    }
    static _calculateAutoScale(sceneDimensionSize, zoomStage) {
        // Taken from Easy Ruler Scale, a mod by Kandashi
        // https://github.com/kandashi/easy-ruler-scale
        const gs = sceneDimensionSize / 100;
        const zs = 1 / zoomStage;
        return gs * zs;
    }
}
class ScalerEditConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(object, options = {}) {
		super(object, options);
	}

    static DEFAULT_OPTIONS ={
        id: "custom-scalers-edit",
        form: {
            handler: ScalerEditConfig.#onSubmit,
            closeOnSubmit: true,
        },
        position: {
            width: 350,
            height: "auto",
        },
        window: {
            contentClasses:["standard-form"]
        },
        tag: "form",
    }
    static PARTS = {
        scalerfoo: {
            template: "modules/nameplate-ruler-hud-scaling/templates/scaler-config.html"
        },
        footer: {
            template: "templates/generic/form-footer.hbs",
        }
    }
    get title() {
        return "Edit Scaler Setting";
    }
    _prepareContext(options) {
        let localStyle = game.customScaler.getLocalStyle(game.scenes.viewed.id);
        let hasLocalSettings = localStyle != null;
        if (!localStyle) {
            localStyle = DEFAULT_STYLE_DEFINITION;
        }
        return {
            globalSettings: game.customScaler.loadGlobalStyle(),
            localSettings: localStyle,
            hasLocalSettings: hasLocalSettings,
            buttons: [
                {type: "submit", icon: "fa-solid fa-save", label:"SETTINGS.Save"}
            ]
        };
    }
    static async #onSubmit(_event, form, formData) {
        if (formData.object.localConfig) {
            let localStyle = {
                fontSize: parseInt(formData.object.localFontSize),
                autoScale: formData.object.localAutoScaleFont,
            };
            await game.customScaler.setLocalStyle(game.scenes.viewed.id, localStyle);
        } else {
            //Remove local settings (as local settings not enabled)
            if (game.customScaler.isSceneBeingViewed()) {
                await game.customScaler.deleteLocalStyle(game.scenes.viewed.id);
            }
        }
        let globalStyle = {
            fontSize: parseInt(formData.object.globalFontSize),
            autoScale: formData.object.globalAutoScaleFont,
        };
        await game.customScaler.saveGlobalStyle(globalStyle);

        ui.notifications.notify("Updated nameplate styles. Please refresh for changes to apply");
        game.customScaler.setCanvasStyle(myCSSSheet);   
    }
}

async function registerSettings() {
    myCSSSheet = customScaleGetTheCSSStyleSheet()
    game.customScaler = new CustomScaler(game, canvas, CONFIG, foundry.utils.mergeObject);
    game.settings.register(mod, "global-style", {
        scope: "world",
        config: false,
        type: Object,
        default: DEFAULT_STYLE,
    });
    /*
     * Scene specific config
     * use game.scenes.viewed.id as key to style
     */
    game.settings.register(mod, "local-styles", {
        scope: "world",
        config: false,
        type: Object,
        default: {},
    });
    game.settings.registerMenu(mod, "settingsMenu", {
        name: "Configuration",
        label: "Settings",
        icon: "fas fa-wrench",
        type: ScalerEditConfig,
        restricted: true,
    });
    let existing = game.customScaler.loadGlobalStyle();
    if (Object.keys(existing).length < 2) {
        await game.customScaler.setGlobalStyle(DEFAULT_STYLE);
    }
    game.customScaler.setCanvasStyle(myCSSSheet);
    registerLibWrapper();
}
function registerLibWrapper() {
    //Override token getTextStyle to prevent it from changing
    libWrapperRegister(
        "foundry.canvas.placeables.Token.prototype._getTextStyle",
        function (wrapped, ...args) {
            return foundry.utils.mergeObject(wrapped(...args), CONFIG.canvasTextStyle);
        },
        "WRAPPER"
    );
    //Mesured Template style change
    libWrapperRegister(
        "foundry.canvas.placeables.MeasuredTemplate.prototype._refreshRulerText",
        function (wrapped, ...args) {
            wrapped(...args);
            this.ruler.style = foundry.utils.mergeObject(this.ruler.style, CONFIG.canvasTextStyle);
        },
        "WRAPPER"
    );
    // Notes change
    libWrapperRegister(
        "foundry.canvas.placeables.Note.prototype._getTextStyle",
        function (wrapped, ...args) {
            return foundry.utils.mergeObject(wrapped(...args), CONFIG.canvasTextStyle);
        },
        "WRAPPER"
    );
}
function libWrapperRegister(target, wrapper, type) {
    libWrapper.register(mod, target, wrapper, type);
}

function customScaleGetTheCSSStyleSheet() {
    for(let sheetiterator of document.styleSheets[2].cssRules) {
        if(sheetiterator.href){
            if(sheetiterator.href.includes("ruler_scaling.css"))
            {
                return sheetiterator.styleSheet;
            }
        }
    }
}

Hooks.on("setup", async () => {
    await registerSettings();
    Hooks.on("canvasInit", () => {
        game.customScaler.setCanvasStyle(myCSSSheet);
    });
    Hooks.once("canvasReady", () => {
        Hooks.on("canvasPan", (c) => {
            game.customScaler.checkAutoScale(c, myCSSSheet);
        });
    });
});
