const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const exclusionList = require("metro-config/private/defaults/exclusionList").default;
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = exclusionList([
  new RegExp(`${path.resolve(__dirname, ".env.release.local").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
  new RegExp(`${path.resolve(__dirname, ".env.release.local.example").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
]);

module.exports = withNativeWind(config, { input: "./global.css" });
