import type { GraphData, GraphNode } from "@/types/graph";

export type SampleId =
  | "overview"
  | "typical-office"
  | "detailed-components"
  | "large-stress"
  | "column-floor-test";

export type SampleComplexity = "Simple" | "Medium" | "Complex" | "Stress";

export interface SampleDefinition {
  id: SampleId;
  name: string;
  description: string;
  complexity: SampleComplexity;
  graph: GraphData;
}

const buildNode = (node: GraphNode): GraphNode => node;

const LAYERS_SMALL = [{ thicknessMm: 120 }, { thicknessMm: 130 }];
const LAYERS_GLASS = [
  { thicknessMm: 6 },
  { thicknessMm: 4 },
  { thicknessMm: 2 },
];

const OVERVIEW_GRAPH: GraphData = {
  nodes: [
    buildNode({
      id: "building",
      name: "Building",
      category: "system",
      elementType: "overall",
      costIndex: 1.02,
      metrics: {
        areaSqm: 12000,
        heightM: 45,
        storeys: 11,
        levelHeightsM: [4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5],
      },
      climate: { windRisk: 0.72, seismicZone: 0.4 },
    }),
    buildNode({
      id: "structure",
      name: "Structural Frame",
      category: "system",
      elementType: "structure",
      metrics: { massTon: 6400, stiffnessK: 0.74, assemblyRate: 0.86 },
      embodied: { carbonKgCO2e: 5_200_000, concreteKg: 2_900_000, steelKg: 1_650_000 },
    }),
    buildNode({
      id: "envelope",
      name: "Envelope",
      category: "system",
      elementType: "facade",
      metrics: { uValueAvg: 0.85, airtightness: 0.91, insulationRsi: 2.4 },
      materials: { glassThicknessMm: 6, aluminiumThicknessMm: 2 },
    }),
    buildNode({
      id: "services",
      name: "Building Services",
      category: "system",
      elementType: "MEP",
      metrics: { plantPowerKw: 1250, airflowM3h: 48_000, diversityFactor: 0.35 },
    }),
    buildNode({
      id: "floor-slab",
      name: "Floor Slab",
      category: "tectonic",
      elementType: "slab",
      material: "post-tensioned concrete",
      level: "typical office",
      metrics: { thicknessMm: 250, loadCapacityKpa: 9.2, spanM: 8 },
      layersMm: LAYERS_SMALL,
    }),
    buildNode({
      id: "column-grid",
      name: "Column Grid",
      category: "tectonic",
      elementType: "column",
      material: "steel H-section",
      grid: "8m x 8m",
      metrics: { spacingM: 8, loadCapacityKn: 3200, effectiveLengthK: 1.1 },
      reinforcementRatio: 0.018,
    }),
    buildNode({
      id: "facade-panel",
      name: "Facade Panel",
      category: "tectonic",
      elementType: "panel",
      material: "glass + aluminium",
      performance: "low-e double glazing",
      metrics: { panelAreaSqm: 30, thermalBridgeIndex: 0.14, anchorCount: 120 },
    }),
    buildNode({
      id: "roof",
      name: "Roof Assembly",
      category: "tectonic",
      elementType: "roof",
      material: "steel deck + insulation + membrane",
      metrics: { rsiValue: 2.4, membraneThicknessMm: 6, insulationThicknessMm: 160 },
    }),
    buildNode({
      id: "core",
      name: "Core Shear Wall",
      category: "tectonic",
      elementType: "shear wall",
      material: "reinforced concrete",
      metrics: { shearWallThicknessMm: 300, shearCapacityKn: 7800, openingsRatio: 0.08 },
      embodied: { carbonKgCO2e: 3_100_000 },
    }),
    buildNode({
      id: "hvac-plant",
      name: "HVAC Plant",
      category: "services",
      elementType: "air handling unit",
      location: "roof plant",
      metrics: { eer: 3.2, efficiencyPercent: 86, airflowM3h: 48_000 },
    }),
    buildNode({
      id: "duct-branch",
      name: "Supply Duct Branch",
      category: "services",
      elementType: "duct",
      material: "galvanised steel",
      level: "typical office",
      metrics: { diameterMm: 250, lengthM: 42, pressureDropPa: 850, ductRoughness: 0.02 },
    }),
    buildNode({
      id: "glazing-unit",
      name: "Glazing Unit",
      category: "component",
      elementType: "IGU",
      material: "double-glazed low-e",
      // Keep the original top-level numeric so it shows up in metadata preview too.
      uValue: 1.2,
      metrics: { uValue: 1.2, visibleTransmittance: 0.62, solarHeatGainFactor: 0.42 },
      glazingLayersMm: LAYERS_GLASS,
      embodied: { carbonKgCO2e: 820_000 },
    }),
  ],
  links: [
    {
      set: "Systems overview",
      notes: "High-level relationships between primary building systems.",
      links: [
        { source: "building", target: "structure", relation: "supported by", distanceM: 12, loadShare: 0.65, connectionQuality: 0.9 },
        { source: "building", target: "envelope", relation: "enclosed by", distanceM: 10, loadShare: 0.0, connectionQuality: 0.75 },
        { source: "building", target: "services", relation: "served by", distanceM: 18, loadShare: 0.2, flowCapacityM3h: 48_000 },
      ],
    },
    {
      set: "Structural tectonics",
      notes: "Structural load path and key tectonic elements.",
      links: [
        { source: "structure", target: "floor-slab", relation: "carries", distanceM: 4, loadShare: 0.5, transferEfficiency: 0.78 },
        { source: "structure", target: "column-grid", relation: "organised by", distanceM: 4, loadShare: 0.5, transferEfficiency: 0.83 },
        { source: "structure", target: "core", relation: "stabilised by", distanceM: 6, loadShare: 0.35, transferEfficiency: 0.88 },
      ],
    },
    {
      set: "Envelope tectonics",
      notes: "Façade composition and interface with structure.",
      links: [
        { source: "envelope", target: "facade-panel", relation: "composed of", distanceM: 2, connectionStrength: 0.66 },
        { source: "envelope", target: "glazing-unit", relation: "integrates", distanceM: 2, connectionStrength: 0.58 },
        { source: "floor-slab", target: "facade-panel", relation: "connects to", distanceM: 1.2, elevationM: 4.5, fixingDensity: 8 },
      ],
    },
    {
      set: "Services distribution",
      notes: "MEP systems and their spatial relationships.",
      links: [
        { source: "services", target: "hvac-plant", relation: "includes", distanceM: 6, flowCapacityM3h: 48_000, pressureDropPa: 620 },
        { source: "services", target: "duct-branch", relation: "distributes via", distanceM: 10, flowCapacityM3h: 36_000, pressureDropPa: 410 },
        { source: "duct-branch", target: "floor-slab", relation: "runs below", distanceM: 3, flowCapacityM3h: 14_000, pressureDropPa: 220 },
      ],
    },
  ],
};

const TYPICAL_OFFICE_GRAPH: GraphData = {
  nodes: [
    buildNode({
      id: "building",
      name: "Building",
      category: "system",
      elementType: "overall",
      costIndex: 1.08,
      metrics: {
        areaSqm: 16_500,
        heightM: 52,
        storeys: 13,
        levelHeightsM: [4, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2],
      },
      climate: { windRisk: 0.65, seismicZone: 0.52 },
    }),
    buildNode({
      id: "structure",
      name: "Structural Frame",
      category: "system",
      elementType: "structure",
      metrics: { massTon: 7400, stiffnessK: 0.78, assemblyRate: 0.82 },
      embodied: { carbonKgCO2e: 5_800_000 },
    }),
    buildNode({
      id: "core",
      name: "Core Shear Wall",
      category: "tectonic",
      elementType: "shear wall",
      metrics: { shearWallThicknessMm: 320, shearCapacityKn: 9100, openingsRatio: 0.07 },
      embodied: { carbonKgCO2e: 3_400_000 },
      quality: { qualityScore: 0.86, variability: 0.12 },
    }),
    buildNode({
      id: "floor-slab-typical",
      name: "Floor Slab (Typical)",
      category: "tectonic",
      elementType: "slab",
      level: "typical office",
      material: "post-tensioned concrete",
      metrics: { thicknessMm: 240, loadCapacityKpa: 9.6, spanM: 9.0 },
      layersMm: [{ thicknessMm: 110 }, { thicknessMm: 130 }],
      reinforcementLayers: [
        { barsPerM: 1150, diameterMm: 18 },
        { barsPerM: 900, diameterMm: 14 },
      ],
    }),
    buildNode({
      id: "floor-slab-roof",
      name: "Roof Deck",
      category: "tectonic",
      elementType: "slab",
      level: "roof",
      metrics: { thicknessMm: 200, loadCapacityKpa: 6.8, spanM: 10.2 },
      layersMm: [{ thicknessMm: 90 }, { thicknessMm: 110 }],
      reinforcementLayers: [
        { barsPerM: 780, diameterMm: 12 },
        { barsPerM: 520, diameterMm: 10 },
      ],
    }),
    buildNode({
      id: "column-grid",
      name: "Column Grid",
      category: "tectonic",
      elementType: "column",
      material: "steel H-section",
      grid: "9m x 9m",
      metrics: { spacingM: 9, loadCapacityKn: 3600, effectiveLengthK: 1.08 },
      reinforcementRatio: 0.021,
      capacityKnByStage: [2100, 2950, 3600],
    }),
    buildNode({
      id: "beam-frame",
      name: "Beam Frame",
      category: "tectonic",
      elementType: "beam",
      metrics: { spanM: 9, momentCapacityKnM: 680, deflectionIndex: 0.22 },
      geometry: { webThicknessMm: 14, flangeWidthMm: 220 },
    }),
    buildNode({
      id: "facade-panel",
      name: "Facade Panel",
      category: "tectonic",
      elementType: "panel",
      metrics: { panelAreaSqm: 28, thermalBridgeIndex: 0.16, anchorCount: 140 },
    }),
    buildNode({
      id: "glazing-unit",
      name: "Glazing Unit",
      category: "component",
      elementType: "IGU",
      material: "double-glazed low-e",
      uValue: 1.0,
      metrics: { uValue: 1.0, visibleTransmittance: 0.64, solarHeatGainFactor: 0.39 },
      glazingLayersMm: LAYERS_GLASS,
      embodied: { carbonKgCO2e: 760_000 },
    }),
    buildNode({
      id: "services",
      name: "Building Services",
      category: "system",
      elementType: "MEP",
      metrics: { plantPowerKw: 1420, airflowM3h: 56_000, diversityFactor: 0.32 },
    }),
    buildNode({
      id: "hvac-plant",
      name: "HVAC Plant",
      category: "services",
      elementType: "air handling unit",
      metrics: { eer: 3.25, efficiencyPercent: 88, airflowM3h: 56_000 },
      control: { economiserEnabled: 1, modulationPercent: 73 },
    }),
    buildNode({
      id: "duct-main",
      name: "Duct Main",
      category: "services",
      elementType: "duct",
      metrics: { diameterMm: 320, lengthM: 55, pressureDropPa: 980, ductRoughness: 0.018 },
    }),
    buildNode({
      id: "duct-branch",
      name: "Supply Duct Branch",
      category: "services",
      elementType: "duct",
      level: "typical office",
      metrics: { diameterMm: 210, lengthM: 35, pressureDropPa: 420, ductRoughness: 0.02 },
      distribution: { diffuserFlowLps: 62, diffuserCount: 14 },
    }),
    buildNode({
      id: "water-riser",
      name: "Water Riser",
      category: "services",
      elementType: "piping",
      metrics: { diameterMm: 110, lengthM: 48, flowRateLps: 8.6, pressureKpa: 230 },
    }),
    buildNode({
      id: "exhaust-fan",
      name: "Exhaust Fan",
      category: "services",
      elementType: "ventilation",
      metrics: { airflowM3h: 12_500, efficiencyPercent: 74, soundDbA: 46 },
    }),
    buildNode({
      id: "stairs-core",
      name: "Stairs + Core Zone",
      category: "tectonic",
      elementType: "circulation",
      metrics: { circulationAreaSqm: 420, egressIndex: 0.91, travelTimeS: 42 },
      constraints: { maxStairsFlights: 4, riserHeightMm: 165 },
    }),
  ],
  links: [
    {
      set: "Systems overview",
      notes: "High-level relationships between primary building systems.",
      links: [
        { source: "building", target: "structure", relation: "supported by", distanceM: 14, loadShare: 0.68, connectionQuality: 0.92 },
        { source: "building", target: "core", relation: "stabilises", distanceM: 6, loadShare: 0.28, connectionQuality: 0.9 },
        { source: "building", target: "services", relation: "served by", distanceM: 20, flowCapacityM3h: 56_000, pressureDropPa: 740 },
      ],
    },
    {
      set: "Vertical framing",
      notes: "Floors and framing components stacked by level.",
      links: [
        { source: "structure", target: "floor-slab-typical", relation: "carries", distanceM: 3.5, loadShare: 0.55, transferEfficiency: 0.8 },
        { source: "structure", target: "floor-slab-roof", relation: "supports", distanceM: 3.0, loadShare: 0.35, transferEfficiency: 0.76 },
        { source: "structure", target: "beam-frame", relation: "frames", distanceM: 2.5, loadShare: 0.45, transferEfficiency: 0.84 },
        { source: "column-grid", target: "floor-slab-typical", relation: "supports", distanceM: 0.8, loadShare: 0.6, connectionStrength: 0.72 },
      ],
    },
    {
      set: "Envelope tectonics",
      notes: "Façade composition and interface with structure.",
      links: [
        { source: "facade-panel", target: "glazing-unit", relation: "includes", distanceM: 1.0, connectionStrength: 0.6 },
        { source: "floor-slab-typical", target: "facade-panel", relation: "connects to", distanceM: 1.2, elevationM: 4.2, fixingDensity: 9 },
        { source: "core", target: "stairs-core", relation: "interfaces", distanceM: 1.1, connectionStrength: 0.77 },
      ],
    },
    {
      set: "Services distribution",
      notes: "MEP systems and their spatial relationships.",
      links: [
        { source: "services", target: "hvac-plant", relation: "includes", distanceM: 7, flowCapacityM3h: 56_000, pressureDropPa: 610 },
        { source: "services", target: "duct-main", relation: "routes via", distanceM: 12, flowCapacityM3h: 44_000, pressureDropPa: 420 },
        { source: "duct-main", target: "duct-branch", relation: "branches to", distanceM: 8, flowCapacityM3h: 18_000, pressureDropPa: 240 },
        { source: "duct-branch", target: "floor-slab-typical", relation: "runs below", distanceM: 3, flowCapacityM3h: 13_000, pressureDropPa: 180 },
        { source: "services", target: "water-riser", relation: "includes", distanceM: 21, flowRateLps: 8.6, pressureKpa: 230 },
        { source: "services", target: "exhaust-fan", relation: "includes", distanceM: 10, airflowM3h: 12_500, soundDbA: 46 },
      ],
    },
  ],
};

const DETAILED_COMPONENTS_GRAPH: GraphData = {
  nodes: [
    buildNode({
      id: "building",
      name: "Building",
      category: "system",
      elementType: "overall",
      metrics: { areaSqm: 22_000, heightM: 68, storeys: 17 },
      embodied: { carbonKgCO2e: 19_000_000 },
    }),
    buildNode({
      id: "structure",
      name: "Structural Frame",
      category: "system",
      elementType: "structure",
      metrics: { massTon: 10_200, stiffnessK: 0.8, assemblyRate: 0.79 },
      geometry: { weldLengthM: 82.5, numberOfJoints: 1450 },
    }),
    buildNode({
      id: "core",
      name: "Core Shear Wall",
      category: "tectonic",
      elementType: "shear wall",
      metrics: { shearWallThicknessMm: 340, shearCapacityKn: 11_500, openingsRatio: 0.06 },
      quality: { qualityScore: 0.9, variability: 0.08 },
    }),
    buildNode({
      id: "floor-slab-typical",
      name: "Floor Slab (Typical)",
      category: "tectonic",
      elementType: "slab",
      metrics: { thicknessMm: 230, loadCapacityKpa: 10.4, spanM: 10.5 },
      layersMm: [{ thicknessMm: 100 }, { thicknessMm: 130 }],
      durability: { chlorideDiffusion: 0.0021, coverMm: 45 },
    }),
    buildNode({
      id: "floor-slab-basement",
      name: "Basement Slab",
      category: "tectonic",
      elementType: "slab",
      metrics: { thicknessMm: 320, loadCapacityKpa: 14.8, spanM: 11.8 },
      layersMm: [{ thicknessMm: 160 }, { thicknessMm: 160 }],
      durability: { chlorideDiffusion: 0.0014, coverMm: 55 },
    }),
    buildNode({
      id: "column-grid",
      name: "Column Grid",
      category: "tectonic",
      elementType: "column",
      metrics: { spacingM: 10, loadCapacityKn: 4200, effectiveLengthK: 1.05 },
      reinforcementRatio: 0.022,
      capacityKnByStage: [2300, 3400, 4200],
    }),
    buildNode({
      id: "beam-frame",
      name: "Beam Frame",
      category: "tectonic",
      elementType: "beam",
      metrics: { spanM: 10, momentCapacityKnM: 920, deflectionIndex: 0.18 },
      geometry: { webThicknessMm: 16, flangeWidthMm: 260, depthMm: 420 },
    }),
    buildNode({
      id: "bracing-system",
      name: "Bracing System",
      category: "tectonic",
      elementType: "bracing",
      metrics: { lengthM: 12.4, axialForceKn: 6400, bucklingSafety: 1.4 },
      memberCount: 96,
    }),
    buildNode({
      id: "envelope",
      name: "Envelope",
      category: "system",
      elementType: "facade",
      metrics: { uValueAvg: 0.76, airtightness: 0.93, insulationRsi: 3.1 },
    }),
    buildNode({
      id: "facade-panel",
      name: "Facade Panel",
      category: "tectonic",
      elementType: "panel",
      metrics: { panelAreaSqm: 34, thermalBridgeIndex: 0.12, anchorCount: 165 },
    }),
    buildNode({
      id: "glazing-unit",
      name: "Glazing Unit",
      category: "component",
      elementType: "IGU",
      uValue: 0.9,
      metrics: { uValue: 0.9, visibleTransmittance: 0.67, solarHeatGainFactor: 0.37 },
      glazingLayersMm: LAYERS_GLASS,
    }),
    buildNode({
      id: "roof",
      name: "Roof Assembly",
      category: "tectonic",
      elementType: "roof",
      metrics: { rsiValue: 3.0, membraneThicknessMm: 7, insulationThicknessMm: 190 },
      durability: { reflectiveCoating: 0.82, membraneLifeYears: 28 },
    }),
    buildNode({
      id: "services",
      name: "Building Services",
      category: "system",
      elementType: "MEP",
      metrics: { plantPowerKw: 2100, airflowM3h: 80_000, diversityFactor: 0.28 },
    }),
    buildNode({
      id: "hvac-plant",
      name: "HVAC Plant",
      category: "services",
      elementType: "air handling unit",
      metrics: { eer: 3.6, efficiencyPercent: 91, airflowM3h: 80_000 },
      control: { economiserEnabled: 1, modulationPercent: 81 },
    }),
    buildNode({
      id: "duct-main",
      name: "Duct Main",
      category: "services",
      elementType: "duct",
      metrics: { diameterMm: 420, lengthM: 78, pressureDropPa: 1220, ductRoughness: 0.016 },
    }),
    buildNode({
      id: "duct-branch",
      name: "Supply Duct Branch",
      category: "services",
      elementType: "duct",
      metrics: { diameterMm: 260, lengthM: 46, pressureDropPa: 510, ductRoughness: 0.019 },
      distribution: { diffuserCount: 24, diffuserFlowLps: 56 },
    }),
    buildNode({
      id: "exhaust-fan",
      name: "Exhaust Fan",
      category: "services",
      elementType: "ventilation",
      metrics: { airflowM3h: 22_000, efficiencyPercent: 76, soundDbA: 49 },
    }),
    buildNode({
      id: "sprinkler-system",
      name: "Sprinkler System",
      category: "services",
      elementType: "fire protection",
      metrics: { coverageM2: 1800, nozzleCount: 92, activationTempC: 68 },
    }),
    buildNode({
      id: "water-riser",
      name: "Water Riser",
      category: "services",
      elementType: "piping",
      metrics: { diameterMm: 140, lengthM: 62, flowRateLps: 11.4, pressureKpa: 270 },
    }),
  ],
  links: [
    {
      set: "Systems overview",
      notes: "High-level relationships between primary building systems.",
      links: [
        { source: "building", target: "structure", relation: "supported by", distanceM: 16, loadShare: 0.72, connectionQuality: 0.93 },
        { source: "building", target: "envelope", relation: "enclosed by", distanceM: 12, loadShare: 0.0, connectionQuality: 0.8 },
        { source: "building", target: "services", relation: "served by", distanceM: 23, flowCapacityM3h: 80_000, pressureDropPa: 910 },
        { source: "structure", target: "core", relation: "stabilised by", distanceM: 7, loadShare: 0.3, transferEfficiency: 0.9 },
      ],
    },
    {
      set: "Structural tectonics",
      notes: "Beams, columns and slabs connected as a load path.",
      links: [
        { source: "structure", target: "floor-slab-typical", relation: "carries", distanceM: 4.2, loadShare: 0.5, transferEfficiency: 0.81 },
        { source: "structure", target: "floor-slab-basement", relation: "supports", distanceM: 6.1, loadShare: 0.4, transferEfficiency: 0.75 },
        { source: "column-grid", target: "floor-slab-typical", relation: "supports", distanceM: 1.0, loadShare: 0.62, connectionStrength: 0.73 },
        { source: "column-grid", target: "floor-slab-basement", relation: "supports", distanceM: 1.2, loadShare: 0.55, connectionStrength: 0.7 },
        { source: "beam-frame", target: "floor-slab-typical", relation: "frames to", distanceM: 2.1, loadShare: 0.45, transferEfficiency: 0.86 },
        { source: "bracing-system", target: "core", relation: "braces", distanceM: 3.0, axialLoadKn: 6400, transferEfficiency: 0.9 },
      ],
    },
    {
      set: "Envelope tectonics",
      notes: "Facade panel interface and glazing integration.",
      links: [
        { source: "envelope", target: "facade-panel", relation: "composed of", distanceM: 2.2, connectionStrength: 0.64 },
        { source: "facade-panel", target: "glazing-unit", relation: "includes", distanceM: 1.1, connectionStrength: 0.57 },
        { source: "floor-slab-typical", target: "facade-panel", relation: "connects to", distanceM: 1.3, elevationM: 5.0, fixingDensity: 10 },
        { source: "roof", target: "envelope", relation: "interfaces", distanceM: 2.0, elevationM: 68, fixingDensity: 7 },
      ],
    },
    {
      set: "Services distribution",
      notes: "MEP systems and their spatial relationships.",
      links: [
        { source: "services", target: "hvac-plant", relation: "includes", distanceM: 10, flowCapacityM3h: 80_000, pressureDropPa: 720 },
        { source: "services", target: "duct-main", relation: "routes via", distanceM: 16, flowCapacityM3h: 68_000, pressureDropPa: 500 },
        { source: "duct-main", target: "duct-branch", relation: "branches to", distanceM: 11, flowCapacityM3h: 27_000, pressureDropPa: 280 },
        { source: "duct-branch", target: "floor-slab-typical", relation: "runs below", distanceM: 4, flowCapacityM3h: 19_000, pressureDropPa: 210 },
        { source: "services", target: "exhaust-fan", relation: "includes", distanceM: 12, airflowM3h: 22_000, soundDbA: 49 },
        { source: "services", target: "sprinkler-system", relation: "includes", distanceM: 8, coverageM2: 1800, nozzleCount: 92 },
        { source: "services", target: "water-riser", relation: "includes", distanceM: 24, flowRateLps: 11.4, pressureKpa: 270 },
      ],
    },
  ],
};

function makeFloorNode(i: number): GraphNode {
  return buildNode({
    id: `floor-${i}`,
    name: `Floor ${i}`,
    category: "tectonic",
    elementType: "slab",
    levelIndex: i,
    metrics: {
      thicknessMm: 200 + i * 5,
      loadCapacityKpa: 7.5 + i * 0.35,
      areaSqm: 1800 + i * 120,
      // Nested numeric arrays to generate dot paths like `metrics.layerThicknessMm.0`
      layerThicknessMm: [120 + i, 90 + i * 0.5, 30],
    },
    layersMm: [{ thicknessMm: 120 + i }, { thicknessMm: 80 + i }],
  });
}

function makeColumnNode(i: number): GraphNode {
  const spacing = 6 + (i % 4) * 1.2;
  const axial = 2200 + i * 230;
  return buildNode({
    id: `col-${i}`,
    name: `Column ${i}`,
    category: "tectonic",
    elementType: "column",
    gridIndex: i,
    metrics: {
      spacingM: spacing,
      loadCapacityKn: axial,
      reinforcementRatio: 0.016 + (i % 5) * 0.0012,
      capacityKnByStage: [axial * 0.55, axial * 0.78, axial],
    },
  });
}

const LARGE_STRESS_GRAPH: GraphData = (() => {
  const nodes: GraphNode[] = [
    buildNode({
      id: "building",
      name: "Building",
      category: "system",
      elementType: "overall",
      metrics: { areaSqm: 55_000, heightM: 120, storeys: 24 },
      costIndex: 1.25,
    }),
    buildNode({
      id: "structure",
      name: "Structural Frame",
      category: "system",
      elementType: "structure",
      metrics: { massTon: 22_000, stiffnessK: 0.84, assemblyRate: 0.74 },
    }),
    buildNode({
      id: "envelope",
      name: "Envelope",
      category: "system",
      elementType: "facade",
      metrics: { uValueAvg: 0.74, airtightness: 0.92, insulationRsi: 3.3 },
    }),
    buildNode({
      id: "services",
      name: "Building Services",
      category: "system",
      elementType: "MEP",
      metrics: { plantPowerKw: 6200, airflowM3h: 240_000, diversityFactor: 0.24 },
    }),
  ];

  const floors = Array.from({ length: 8 }, (_, idx) => makeFloorNode(idx + 1));
  const columns = Array.from({ length: 16 }, (_, idx) => makeColumnNode(idx + 1));

  const beams: GraphNode[] = Array.from({ length: 12 }, (_, idx) =>
    buildNode({
      id: `beam-${idx + 1}`,
      name: `Beam ${idx + 1}`,
      category: "tectonic",
      elementType: "beam",
      metrics: {
        spanM: 8 + idx * 0.3,
        momentCapacityKnM: 650 + idx * 42,
        depthMm: 360 + idx * 8,
      },
    })
  );

  const ducts: GraphNode[] = Array.from({ length: 6 }, (_, idx) =>
    buildNode({
      id: `duct-${idx + 1}`,
      name: `Duct ${idx + 1}`,
      category: "services",
      elementType: "duct",
      metrics: {
        diameterMm: 180 + idx * 35,
        lengthM: 30 + idx * 7,
        pressureDropPa: 300 + idx * 55,
      },
    })
  );

  nodes.push(...floors, ...columns, ...beams, ...ducts);

  const links = [
    {
      set: "Systems overview",
      notes: "High-level relationships between primary building systems.",
      links: [
        { source: "building", target: "structure", relation: "supported by", distanceM: 20, loadShare: 0.7, connectionQuality: 0.91 },
        { source: "building", target: "envelope", relation: "enclosed by", distanceM: 14, loadShare: 0.0, connectionQuality: 0.8 },
        { source: "building", target: "services", relation: "served by", distanceM: 30, flowCapacityM3h: 240_000, pressureDropPa: 1400 },
      ],
    },
    {
      set: "Vertical framing",
      notes: "Floors, beams and columns connected into vertical load paths.",
      links: [
        ...floors.map((f) => ({
          source: "structure",
          target: f.id,
          relation: "carries",
          distanceM: 2.6,
          loadShare: 0.45,
          transferEfficiency: 0.78,
        })),
        ...beams.map((b) => ({
          source: "structure",
          target: b.id,
          relation: "frames",
          distanceM: 2.0,
          loadShare: 0.35,
          transferEfficiency: 0.83,
        })),
      ],
    },
    {
      set: "Columns & floors",
      notes: "Deterministic connections (some columns intentionally miss a floor).",
      links: (() => {
        const colFloorLinks: Array<Record<string, unknown>> = [];
        for (let c = 1; c <= columns.length; c++) {
          for (let f = 1; f <= floors.length; f++) {
            // Deterministic pattern to create variety in connectivity.
            const shouldConnect = (c + f) % 3 === 0 || (c % 5 === 0 && f % 2 === 0);
            if (!shouldConnect) continue;
            colFloorLinks.push({
              source: `col-${c}`,
              target: `floor-${f}`,
              relation: "touches",
              distanceM: 0.9,
              loadShare: 0.55 + ((c + f) % 7) * 0.02,
              connectionStrength: 0.5 + (((c * f) % 10) / 20),
            });
          }
        }
        return colFloorLinks as any;
      })(),
    },
    {
      set: "Envelope tectonics",
      notes: "Envelope interfaces with selected tectonic nodes.",
      links: [
        { source: "envelope", target: "floor-1", relation: "interfaces", distanceM: 1.8, fixingDensity: 7 },
        { source: "envelope", target: "floor-4", relation: "interfaces", distanceM: 2.1, fixingDensity: 9 },
        { source: "envelope", target: "floor-8", relation: "interfaces", distanceM: 2.4, fixingDensity: 6 },
      ],
    },
    {
      set: "Services distribution",
      notes: "Services nodes routed to duct branches and floors.",
      links: [
        { source: "services", target: "duct-1", relation: "routes via", distanceM: 22, flowCapacityM3h: 80_000, pressureDropPa: 520 },
        { source: "services", target: "duct-2", relation: "routes via", distanceM: 26, flowCapacityM3h: 62_000, pressureDropPa: 610 },
        { source: "services", target: "duct-3", relation: "routes via", distanceM: 30, flowCapacityM3h: 55_000, pressureDropPa: 460 },
        { source: "duct-1", target: "floor-2", relation: "runs below", distanceM: 3.2, flowCapacityM3h: 28_000, pressureDropPa: 180 },
        { source: "duct-2", target: "floor-3", relation: "runs below", distanceM: 3.0, flowCapacityM3h: 25_000, pressureDropPa: 170 },
        { source: "duct-3", target: "floor-5", relation: "runs below", distanceM: 2.8, flowCapacityM3h: 24_000, pressureDropPa: 165 },
        { source: "duct-4", target: "floor-4", relation: "runs below", distanceM: 3.1, flowCapacityM3h: 20_000, pressureDropPa: 140 },
        { source: "duct-5", target: "floor-6", relation: "runs below", distanceM: 3.4, flowCapacityM3h: 18_000, pressureDropPa: 155 },
        { source: "duct-6", target: "floor-8", relation: "runs below", distanceM: 3.7, flowCapacityM3h: 17_000, pressureDropPa: 160 },
      ],
    },
  ];

  return { nodes, links };
})();

const COLUMN_FLOOR_TEST_GRAPH: GraphData = (() => {
  const nodes: GraphNode[] = [
    buildNode({
      id: "building",
      name: "Building",
      category: "system",
      elementType: "overall",
      metrics: { areaSqm: 9000, heightM: 36, storeys: 8 },
      costIndex: 0.98,
    }),
    buildNode({
      id: "structure",
      name: "Structural Frame",
      category: "system",
      elementType: "structure",
      metrics: { massTon: 4100, stiffnessK: 0.76, assemblyRate: 0.9 },
    }),
    buildNode({
      id: "core",
      name: "Core",
      category: "tectonic",
      elementType: "shear wall",
      metrics: { shearWallThicknessMm: 280, shearCapacityKn: 7200, openingsRatio: 0.09 },
    }),
  ];

  const floors = Array.from({ length: 4 }, (_, idx) =>
    buildNode({
      id: `floor-${idx + 1}`,
      name: `Floor ${idx + 1}`,
      category: "tectonic",
      elementType: "slab",
      "Building Element": "Floor",
      metrics: {
        thicknessMm: 210 + idx * 10,
        loadCapacityKpa: 8.2 + idx * 0.55,
        areaSqm: 1500 + idx * 200,
      },
      durability: { coverMm: 45 + idx * 2, chlorideDiffusion: 0.0020 - idx * 0.0001 },
    })
  );

  const columns = Array.from({ length: 10 }, (_, idx) => {
    const i = idx + 1;
    const axial = 1800 + i * 250;
    const quality = 0.78 + (i % 4) * 0.05 - i * 0.01;
    return buildNode({
      id: `col-${i}`,
      name: `Column ${i}`,
      category: "tectonic",
      elementType: "column",
      "Building Element": "Column",
      metrics: {
        spacingM: 7 + (i % 3) * 0.7,
        loadCapacityKn: axial,
        axialLoadKn: axial,
        ductilityIndex: 1.1 + (i % 5) * 0.08,
        qualityScore: quality,
      },
      reinforcementRatio: 0.015 + (i % 6) * 0.0015,
    });
  });

  nodes.push(...floors, ...columns);

  const linkSets: GraphData["links"] = [
    {
      set: "Systems overview",
      notes: "High-level relationships between primary building systems.",
      links: [
        { source: "building", target: "structure", relation: "supported by", distanceM: 10, loadShare: 0.7, connectionQuality: 0.9 },
        { source: "structure", target: "core", relation: "stabilised by", distanceM: 5, loadShare: 0.3, transferEfficiency: 0.88 },
      ],
    },
    {
      set: "Column-floor connections",
      notes: "Some columns intentionally miss any floor link to trigger the column-floor test.",
      links: (() => {
        const links: Array<Record<string, unknown>> = [];

        for (let c = 1; c <= columns.length; c++) {
          const source = `col-${c}`;

          // Connectivity pattern:
          // - col-1..col-6 connect to floor-1 and floor-2
          // - col-7..col-8 connect only to floor-4
          // - col-9..col-10 connect to no floors
          const targets: number[] =
            c <= 6 ? [1, 2] : c <= 8 ? [4] : [];

          for (const f of targets) {
            const strength = 0.58 + ((c * f) % 10) / 30;
            const transfer = 0.62 + ((c + f) % 7) * 0.03;
            links.push({
              source,
              target: `floor-${f}`,
              relation: "touches",
              distanceM: 0.8,
              connectionStrength: strength,
              transferEfficiency: transfer,
              connectionType: c <= 6 ? "bearing" : "anchored",
            });
          }
        }

        return links as any;
      })(),
    },
    {
      set: "Envelope tectonics",
      notes: "A few extra numeric link metrics for metadata preview.",
      links: [
        { source: "core", target: "floor-1", relation: "interfaces", distanceM: 1.2, fixingDensity: 8 },
        { source: "core", target: "floor-3", relation: "interfaces", distanceM: 1.4, fixingDensity: 10 },
      ],
    },
  ];

  return { nodes, links: linkSets };
})();

export const SAMPLE_DEFINITIONS: SampleDefinition[] = [
  {
    id: "overview",
    name: "Sample 1: System overview",
    description: "Small-to-medium graph with multiple node and link metrics for the metadata preview.",
    complexity: "Simple",
    graph: OVERVIEW_GRAPH,
  },
  {
    id: "typical-office",
    name: "Sample 2: Typical office",
    description: "More detailed metrics (nested layers, reinforcement, and QA) to explore dot-path numeric attributes.",
    complexity: "Medium",
    graph: TYPICAL_OFFICE_GRAPH,
  },
  {
    id: "detailed-components",
    name: "Sample 3: Detailed components",
    description: "Complex component mix with durability, geometry, and service metrics.",
    complexity: "Complex",
    graph: DETAILED_COMPONENTS_GRAPH,
  },
  {
    id: "large-stress",
    name: "Sample 4: Large stress graph",
    description: "A bigger graph with many numeric attributes and partial column-floor connectivity.",
    complexity: "Stress",
    graph: LARGE_STRESS_GRAPH,
  },
  {
    id: "column-floor-test",
    name: "Sample 5: Column-floor test focus",
    description: "Columns/floors are explicitly tagged so the column-floor test produces mixed faulty/non-faulty nodes.",
    complexity: "Complex",
    graph: COLUMN_FLOOR_TEST_GRAPH,
  },
];

