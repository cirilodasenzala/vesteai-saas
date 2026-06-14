"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PREMIUM_PLAN_CODE = exports.Intent = exports.TryOnStatus = exports.EventType = exports.MsgType = exports.MsgDirection = exports.ConvState = exports.SubStatus = exports.Style = exports.Language = exports.Sex = void 0;
var Sex;
(function (Sex) {
    Sex["MALE"] = "MALE";
    Sex["FEMALE"] = "FEMALE";
    Sex["OTHER"] = "OTHER";
})(Sex || (exports.Sex = Sex = {}));
var Language;
(function (Language) {
    Language["PT"] = "PT";
    Language["EN"] = "EN";
    Language["OTHER"] = "OTHER";
})(Language || (exports.Language = Language = {}));
var Style;
(function (Style) {
    Style["CASUAL"] = "CASUAL";
    Style["OLD_MONEY"] = "OLD_MONEY";
    Style["STREETWEAR"] = "STREETWEAR";
    Style["MINIMALISTA"] = "MINIMALISTA";
    Style["QUIET_LUXURY"] = "QUIET_LUXURY";
    Style["ESPORTIVO"] = "ESPORTIVO";
    Style["ELEGANTE"] = "ELEGANTE";
    Style["SOCIAL"] = "SOCIAL";
    Style["FORMAL"] = "FORMAL";
    Style["LUXURY"] = "LUXURY";
})(Style || (exports.Style = Style = {}));
var SubStatus;
(function (SubStatus) {
    SubStatus["NONE"] = "NONE";
    SubStatus["PENDING"] = "PENDING";
    SubStatus["ACTIVE"] = "ACTIVE";
    SubStatus["PAST_DUE"] = "PAST_DUE";
    SubStatus["CANCELED"] = "CANCELED";
})(SubStatus || (exports.SubStatus = SubStatus = {}));
var ConvState;
(function (ConvState) {
    ConvState["NEW"] = "NEW";
    ConvState["AWAITING_PAYMENT"] = "AWAITING_PAYMENT";
    ConvState["ONBOARDING"] = "ONBOARDING";
    ConvState["IDLE"] = "IDLE";
    ConvState["TRYON_BODY"] = "TRYON_BODY";
    ConvState["TRYON_GARMENT"] = "TRYON_GARMENT";
    ConvState["TRYON_PROCESSING"] = "TRYON_PROCESSING";
    ConvState["EVENT_DETAILS"] = "EVENT_DETAILS";
    ConvState["CONSULTING"] = "CONSULTING";
    ConvState["WARDROBE_INTAKE"] = "WARDROBE_INTAKE";
})(ConvState || (exports.ConvState = ConvState = {}));
var MsgDirection;
(function (MsgDirection) {
    MsgDirection["INBOUND"] = "INBOUND";
    MsgDirection["OUTBOUND"] = "OUTBOUND";
})(MsgDirection || (exports.MsgDirection = MsgDirection = {}));
var MsgType;
(function (MsgType) {
    MsgType["TEXT"] = "TEXT";
    MsgType["IMAGE"] = "IMAGE";
    MsgType["TEMPLATE"] = "TEMPLATE";
    MsgType["AUDIO"] = "AUDIO";
    MsgType["LOCATION"] = "LOCATION";
})(MsgType || (exports.MsgType = MsgType = {}));
var EventType;
(function (EventType) {
    EventType["WEDDING"] = "WEDDING";
    EventType["INTERVIEW"] = "INTERVIEW";
    EventType["GOING_OUT"] = "GOING_OUT";
    EventType["CHURCH"] = "CHURCH";
    EventType["TRAVEL"] = "TRAVEL";
    EventType["BEACH"] = "BEACH";
    EventType["COLLEGE"] = "COLLEGE";
    EventType["WORK"] = "WORK";
    EventType["GYM"] = "GYM";
    EventType["DINNER"] = "DINNER";
    EventType["PARTY"] = "PARTY";
    EventType["GRADUATION"] = "GRADUATION";
    EventType["CORPORATE"] = "CORPORATE";
    EventType["OTHER"] = "OTHER";
})(EventType || (exports.EventType = EventType = {}));
var TryOnStatus;
(function (TryOnStatus) {
    TryOnStatus["QUEUED"] = "QUEUED";
    TryOnStatus["PROCESSING"] = "PROCESSING";
    TryOnStatus["DONE"] = "DONE";
    TryOnStatus["FAILED"] = "FAILED";
})(TryOnStatus || (exports.TryOnStatus = TryOnStatus = {}));
var Intent;
(function (Intent) {
    Intent["EVENT"] = "EVENT";
    Intent["TRYON"] = "TRYON";
    Intent["CONSULT"] = "CONSULT";
    Intent["WARDROBE_ADD"] = "WARDROBE_ADD";
    Intent["WARDROBE_USE"] = "WARDROBE_USE";
    Intent["CHAT"] = "CHAT";
})(Intent || (exports.Intent = Intent = {}));
exports.PREMIUM_PLAN_CODE = 'premium_monthly';
//# sourceMappingURL=index.js.map