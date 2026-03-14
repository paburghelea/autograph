using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Rhino;
using Rhino.Commands;
using Rhino.DocObjects;

public class WriteAttributeCommand : Command
{
    public override string EnglishName => "WriteAttribute";

    private sealed class MatchChoice
    {
        public MatchChoice(string value, double score, bool isAliasHit)
        {
            Value = value;
            Score = score;
            IsAliasHit = isAliasHit;
        }

        public string Value { get; }
        public double Score { get; }
        public bool IsAliasHit { get; }
    }

    private sealed class KeyGroup
    {
        public KeyGroup(string keyName, IList<string> candidates)
        {
            KeyName = keyName;
            Candidates = candidates;
        }

        public string KeyName { get; private set; }
        public IList<string> Candidates { get; private set; }
    }

    private static readonly Regex CamelCaseBoundary = new Regex("([a-z])([A-Z])", RegexOptions.Compiled);
    private static readonly Regex NonWordSeparators = new Regex(@"[^a-z0-9]+", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly KeyGroup BuildingElementGroup = new KeyGroup(
        "Building Element",
        new List<string>
        {
            "CurtainWall",
            "Panel",
            "Window",
            "Door",
            "Wall",
            "Slab",
            "Floor",
            "Roof",
            "Ceiling",
            "Beam",
            "Column",
            "Foundation",
            "Footing",
            "Pile",
            "Stair",
            "Ramp",
            "Railing",
            "Balustrade",
            "Furniture",
            "Equipment",
            "Opening",
            "GenericElement",
        }
    );

    private static readonly KeyGroup FunctionalRoleGroup = new KeyGroup(
        "Functional Role",
        new List<string>
        {
            "LoadBearing",
            "NonLoadBearing",
            "Bracing",
            "Shear",
            "Partition",
            "Envelope",
            "Facade",
            "Core",
            "Circulation",
            "Separation",
            "Thermal",
            "Acoustic",
            "FireSeparation",
            "WeatherBarrier",
            "Primary",
            "Secondary",
            "Service",
            "Temporary",
        }
    );

    private static readonly KeyGroup MaterialSystemGroup = new KeyGroup(
        "Material System",
        new List<string>
        {
            "Concrete",
            "Steel",
            "Timber",
            "Masonry",
            "Glass",
            "Aluminium",
            "Composite",
            "SandwichPanel",
            "CLT",
            "GFRP",
            "CFRP",
            "Gypsum",
            "Plaster",
            "Insulation",
            "Finish",
            "Soil",
            "Earth",
            "Asphalt",
        }
    );

    private static readonly List<KeyGroup> KeyGroups = new List<KeyGroup>
    {
        BuildingElementGroup,
        FunctionalRoleGroup,
        MaterialSystemGroup,
    };

    private static readonly Dictionary<string, string[]> FunctionalRoleAliases =
        new Dictionary<string, string[]>
    {
        { "LoadBearing", new[] { "loadbearing", "load bearing", "primary", "struct", "structure" } },
        { "NonLoadBearing", new[] { "nonloadbearing", "non load bearing", "secondary" } },
        { "Bracing", new[] { "brace", "bracing", "braced" } },
        { "Shear", new[] { "shear", "core wall", "shearwall" } },
        { "Partition", new[] { "partition", "int", "internal", "stud", "drywall" } },
        { "Envelope", new[] { "envelope", "ext", "external", "weather", "façade", "facade" } },
        { "Facade", new[] { "facade", "façade", "cladding", "rainscreen", "curtain" } },
        { "Core", new[] { "core", "shaft", "lift", "elevator", "stair core" } },
        { "Circulation", new[] { "circulation", "corridor", "stair", "ramp", "lobby" } },
        { "Separation", new[] { "separation", "divider", "screen" } },
        { "Thermal", new[] { "thermal", "insulation", "uvalue", "u-value" } },
        { "Acoustic", new[] { "acoustic", "sound", "stc" } },
        { "FireSeparation", new[] { "fire", "fire rated", "fire-rated", "fr", "firestop" } },
        { "WeatherBarrier", new[] { "weather", "air barrier", "vapour", "vapor", "membrane", "waterproof" } },
        { "Primary", new[] { "primary", "main" } },
        { "Secondary", new[] { "secondary", "sub" } },
        { "Service", new[] { "service", "mep", "hvac", "duct", "pipe", "cable", "plant" } },
        { "Temporary", new[] { "temp", "temporary", "construction" } }
    };

    private static readonly Dictionary<string, string[]> MaterialSystemAliases =
        new Dictionary<string, string[]>
    {
        { "Concrete", new[] { "concrete", "conc", "rc", "reinforced", "precast", "c30", "c40" } },
        { "Steel", new[] { "steel", "stl", "metal", "ub", "uc", "rhs", "shs", "i-beam", "ibeam" } },
        { "Timber", new[] { "timber", "wood", "glulam", "lvl" } },
        { "Masonry", new[] { "masonry", "brick", "block", "cmu", "stone" } },
        { "Glass", new[] { "glass", "glazing", "dgu", "sgu", "igi", "laminated" } },
        { "Aluminium", new[] { "aluminium", "aluminum", "alu" } },
        { "Composite", new[] { "composite", "grp", "frp" } },
        { "SandwichPanel", new[] { "sandwich", "sip", "insulated panel" } },
        { "CLT", new[] { "clt", "cross laminated" } },
        { "GFRP", new[] { "gfrp", "glass fiber", "glass fibre" } },
        { "CFRP", new[] { "cfrp", "carbon fiber", "carbon fibre" } },
        { "Gypsum", new[] { "gypsum", "gwb", "plasterboard", "drywall" } },
        { "Plaster", new[] { "plaster", "stucco" } },
        { "Insulation", new[] { "insulation", "pir", "mineral wool", "rockwool", "xps", "eps" } },
        { "Finish", new[] { "finish", "paint", "tile", "carpet", "flooring" } },
        { "Soil", new[] { "soil", "topsoil" } },
        { "Earth", new[] { "earth", "rammed", "clay" } },
        { "Asphalt", new[] { "asphalt", "tarmac" } }
    };

    private static readonly Dictionary<string, string[]> BuildingElementAliases =
        new Dictionary<string, string[]>
    {
        { "CurtainWall", new[] { "curtain wall", "cw", "unitized", "stick system", "mullion", "transom" } },
        { "Panel", new[] { "panel", "facade", "façade", "cladding", "rainscreen", "gfrc", "gfrp", "spandrel", "acm", "alu", "aluminium" } },
        { "Window", new[] { "window", "glazing", "glass", "vision" } },
        { "Door", new[] { "door", "door leaf", "door frame" } },
        { "Wall", new[] { "wall", "partition", "stud", "masonry", "blockwork", "drywall", "gwb", "shear wall" } },
        { "Slab", new[] { "slab", "flat slab", "pt slab", "post tension", "deck slab" } },
        { "Floor", new[] { "floor", "raised floor", "screed", "flooring" } },
        { "Roof", new[] { "roof", "canopy", "overhang", "green roof" } },
        { "Ceiling", new[] { "ceiling", "soffit", "suspended ceiling", "acoustic", "baffle" } },
        { "Beam", new[] { "beam", "girder", "joist", "lintel", "rib", "ribs" } },
        { "Column", new[] { "column", "pillar", "post", "pier" } },
        { "Foundation", new[] { "foundation", "raft", "mat foundation", "basement slab" } },
        { "Footing", new[] { "footing", "pad footing", "strip footing" } },
        { "Pile", new[] { "pile", "caisson", "bored pile", "micropile" } },
        { "Stair", new[] { "stair", "staircase", "step", "tread", "riser" } },
        { "Ramp", new[] { "ramp" } },
        { "Railing", new[] { "railing", "guardrail", "handrail" } },
        { "Balustrade", new[] { "balustrade", "baluster" } },
        { "Furniture", new[] { "furniture", "desk", "table", "chair", "bench", "cabinet", "shelf" } },
        { "Equipment", new[] { "equipment", "machine", "plant", "hvac", "unit", "fixture" } },
        { "Opening", new[] { "opening", "void", "shaft", "cutout", "core" } },
        { "GenericElement", Array.Empty<string>() }
    };

    private static readonly Dictionary<string, Dictionary<string, string[]>> GroupAliasMaps =
        BuildGroupAliasMaps();

    protected override Result RunCommand(RhinoDoc doc, RunMode mode)
    {
        int scannedObjects = 0;
        int updatedObjects = 0;
        int unchangedObjects = 0;
        int skippedNoLayer = 0;
        int parentLinkIssues = 0;
        int parentLoopIssues = 0;
        int writeOperations = 0;
        int aliasHitCount = 0;
        int fuzzyFallbackCount = 0;

        Dictionary<string, Dictionary<string, int>> valueSelectionCounts = BuildSelectionCounters();

        var objectEnumerator = doc.Objects.GetEnumerator();
        while (objectEnumerator.MoveNext())
        {
            RhinoObject obj = objectEnumerator.Current;
            if (obj == null)
                continue;

            scannedObjects++;

            ObjectAttributes currentAttrs = obj.Attributes;
            int layerIndex = currentAttrs.LayerIndex;
            if (layerIndex < 0 || layerIndex >= doc.Layers.Count)
            {
                skippedNoLayer++;
                continue;
            }

            string layerSearchText = BuildLayerSearchText(doc, layerIndex, ref parentLinkIssues, ref parentLoopIssues);
            string normalizedLayer = NormalizeForSearch(layerSearchText);
            string compactLayer = NormalizeCompact(normalizedLayer);
            HashSet<string> layerTokens = Tokenize(normalizedLayer);
            ObjectAttributes updatedAttrs = currentAttrs.Duplicate();
            bool changed = false;

            for (int i = 0; i < KeyGroups.Count; i++)
            {
                KeyGroup group = KeyGroups[i];
                Dictionary<string, string[]> aliasMap = GroupAliasMaps[group.KeyName];
                MatchChoice bestChoice = SelectBestCandidate(
                    normalizedLayer,
                    compactLayer,
                    layerTokens,
                    group.Candidates,
                    aliasMap
                );

                if (bestChoice.IsAliasHit)
                    aliasHitCount++;
                else
                    fuzzyFallbackCount++;

                string existingValue = updatedAttrs.GetUserString(group.KeyName);
                if (existingValue == bestChoice.Value)
                    continue;

                updatedAttrs.SetUserString(group.KeyName, bestChoice.Value);
                IncrementSelectionCount(valueSelectionCounts, group.KeyName, bestChoice.Value);
                changed = true;
                writeOperations++;
            }

            if (!changed)
            {
                unchangedObjects++;
                continue;
            }

            bool modified = doc.Objects.ModifyAttributes(obj, updatedAttrs, true);
            if (modified)
                updatedObjects++;
            else
                unchangedObjects++;
        }

        RhinoApp.WriteLine("[WriteAttribute] Completed.");
        RhinoApp.WriteLine("[WriteAttribute] Scanned: {0}", scannedObjects);
        RhinoApp.WriteLine("[WriteAttribute] Updated objects: {0}", updatedObjects);
        RhinoApp.WriteLine("[WriteAttribute] Unchanged objects: {0}", unchangedObjects);
        RhinoApp.WriteLine("[WriteAttribute] Write operations: {0}", writeOperations);
        RhinoApp.WriteLine("[WriteAttribute] Skipped (no layer): {0}", skippedNoLayer);
        RhinoApp.WriteLine("[WriteAttribute] Parent link issues: {0}", parentLinkIssues);
        RhinoApp.WriteLine("[WriteAttribute] Parent loop issues: {0}", parentLoopIssues);
        RhinoApp.WriteLine("[WriteAttribute] Alias matches used: {0}", aliasHitCount);
        RhinoApp.WriteLine("[WriteAttribute] Fuzzy fallback used: {0}", fuzzyFallbackCount);
        PrintSelectionSummary(valueSelectionCounts);

        return Result.Success;
    }

    private static MatchChoice SelectBestCandidate(
        string normalizedLayer,
        string compactLayer,
        HashSet<string> layerTokens,
        IList<string> candidates,
        Dictionary<string, string[]> aliasMap
    )
    {
        string bestValue = candidates[0];
        double bestScore = double.MinValue;
        bool bestIsAliasHit = false;

        for (int i = 0; i < candidates.Count; i++)
        {
            string candidate = candidates[i];
            string normalizedCandidate = NormalizeForSearch(candidate);
            string compactCandidate = NormalizeCompact(normalizedCandidate);
            HashSet<string> candidateTokens = Tokenize(normalizedCandidate);
            double baseScore = ScoreCandidate(
                normalizedLayer,
                compactLayer,
                layerTokens,
                normalizedCandidate,
                compactCandidate,
                candidateTokens
            );
            double aliasBoost = ComputeAliasBoost(
                normalizedLayer,
                compactLayer,
                candidate,
                aliasMap
            );
            double score = baseScore + aliasBoost;
            bool isAliasHit = aliasBoost > 0.0;

            // Keep deterministic tie behavior: first candidate in list wins on equal score.
            if (score > bestScore)
            {
                bestScore = score;
                bestValue = candidate;
                bestIsAliasHit = isAliasHit;
            }
        }

        return new MatchChoice(bestValue, bestScore, bestIsAliasHit);
    }

    private static double ScoreCandidate(
        string normalizedLayer,
        string compactLayer,
        HashSet<string> layerTokens,
        string normalizedCandidate,
        string compactCandidate,
        HashSet<string> candidateTokens
    )
    {
        int sharedTokenCount = CountSharedTokens(layerTokens, candidateTokens);
        double tokenScore = candidateTokens.Count > 0
            ? (double)sharedTokenCount / candidateTokens.Count
            : 0.0;

        double containsScore = normalizedLayer.Contains(normalizedCandidate) ? 1.0 : 0.0;
        double sequenceScore = LongestCommonSubstringRatio(normalizedLayer, normalizedCandidate);
        double editSimilarity = NormalizedLevenshteinSimilarity(compactLayer, compactCandidate);
        double compactContainsScore = compactLayer.Contains(compactCandidate) ? 1.0 : 0.0;
        double compactPrefixScore = compactLayer.StartsWith(compactCandidate) ? 1.0 : 0.0;
        double compactExactScore = compactLayer == compactCandidate ? 1.0 : 0.0;
        double compactScore = (compactContainsScore * 0.50)
            + (compactPrefixScore * 0.30)
            + (compactExactScore * 0.20);

        // Reference expectations for typo/case handling:
        // nonloadbearing -> NonLoadBearing
        // non-load-bearng -> NonLoadBearing
        // fire seperation -> FireSeparation
        return (tokenScore * 0.30)
            + (compactScore * 0.25)
            + (editSimilarity * 0.35)
            + (containsScore * 0.05)
            + (sequenceScore * 0.05);
    }

    private static Dictionary<string, Dictionary<string, string[]>> BuildGroupAliasMaps()
    {
        var maps = new Dictionary<string, Dictionary<string, string[]>>();
        maps[BuildingElementGroup.KeyName] = BuildingElementAliases;
        maps[FunctionalRoleGroup.KeyName] = FunctionalRoleAliases;
        maps[MaterialSystemGroup.KeyName] = MaterialSystemAliases;
        return maps;
    }

    private static double ComputeAliasBoost(
        string normalizedLayer,
        string compactLayer,
        string candidate,
        Dictionary<string, string[]> aliasMap
    )
    {
        string[] aliases;
        if (aliasMap == null || !aliasMap.TryGetValue(candidate, out aliases) || aliases == null)
            return 0.0;

        double bestAliasBoost = 0.0;
        for (int i = 0; i < aliases.Length; i++)
        {
            string alias = aliases[i];
            if (string.IsNullOrWhiteSpace(alias))
                continue;

            string normalizedAlias = NormalizeForSearch(alias);
            string compactAlias = NormalizeCompact(normalizedAlias);
            if (string.IsNullOrWhiteSpace(compactAlias))
                continue;

            if (compactLayer == compactAlias)
                bestAliasBoost = Max(bestAliasBoost, 2.0);
            else if (compactLayer.Contains(compactAlias))
                bestAliasBoost = Max(bestAliasBoost, 1.8);
            else if (compactLayer.StartsWith(compactAlias))
                bestAliasBoost = Max(bestAliasBoost, 1.7);
            else if (!string.IsNullOrWhiteSpace(normalizedAlias) && normalizedLayer.Contains(normalizedAlias))
                bestAliasBoost = Max(bestAliasBoost, 1.6);
        }

        return bestAliasBoost;
    }

    private static double Max(double a, double b)
    {
        return a > b ? a : b;
    }

    private static int CountSharedTokens(HashSet<string> layerTokens, HashSet<string> candidateTokens)
    {
        int count = 0;
        foreach (string token in candidateTokens)
        {
            if (layerTokens.Contains(token))
                count++;
        }

        return count;
    }

    private static string NormalizeForSearch(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        string splitCamel = CamelCaseBoundary.Replace(input, "$1 $2");
        string lower = splitCamel.ToLowerInvariant();
        string normalized = NonWordSeparators.Replace(lower, " ").Trim();
        return normalized;
    }

    private static string NormalizeCompact(string normalized)
    {
        if (string.IsNullOrWhiteSpace(normalized))
            return string.Empty;

        return normalized.Replace(" ", string.Empty);
    }

    private static HashSet<string> Tokenize(string normalized)
    {
        var tokens = new HashSet<string>();
        if (string.IsNullOrWhiteSpace(normalized))
            return tokens;

        string[] parts = normalized.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        for (int i = 0; i < parts.Length; i++)
            tokens.Add(parts[i]);

        return tokens;
    }

    private static string BuildLayerSearchText(
        RhinoDoc doc,
        int layerIndex,
        ref int parentLinkIssues,
        ref int parentLoopIssues
    )
    {
        Layer baseLayer = doc.Layers[layerIndex];
        var parentChain = new List<string>();
        var visitedLayerIds = new HashSet<Guid>();
        Layer currentLayer = baseLayer;

        while (currentLayer != null)
        {
            if (visitedLayerIds.Contains(currentLayer.Id))
            {
                parentLoopIssues++;
                RhinoApp.WriteLine("[WriteAttribute] Parent loop detected at layer '{0}'.", currentLayer.Name);
                break;
            }

            visitedLayerIds.Add(currentLayer.Id);
            parentChain.Add(currentLayer.Name);

            if (currentLayer.ParentLayerId == Guid.Empty)
                break;

            Layer parentLayer = doc.Layers.FindId(currentLayer.ParentLayerId);
            if (parentLayer == null)
            {
                parentLinkIssues++;
                RhinoApp.WriteLine(
                    "[WriteAttribute] Missing parent layer for '{0}' (ParentLayerId: {1}).",
                    currentLayer.Name,
                    currentLayer.ParentLayerId
                );
                break;
            }

            currentLayer = parentLayer;
        }

        parentChain.Reverse();
        string parentPathText = string.Join(" ", parentChain.ToArray());
        string fullPath = baseLayer.FullPath ?? string.Empty;
        string currentName = baseLayer.Name ?? string.Empty;

        return string.Format("{0} {1} {2}", fullPath, parentPathText, currentName).Trim();
    }

    private static double LongestCommonSubstringRatio(string source, string target)
    {
        if (string.IsNullOrEmpty(source) || string.IsNullOrEmpty(target))
            return 0.0;

        int sourceLength = source.Length;
        int targetLength = target.Length;
        int[,] dp = new int[sourceLength + 1, targetLength + 1];
        int longest = 0;

        for (int i = 1; i <= sourceLength; i++)
        {
            for (int j = 1; j <= targetLength; j++)
            {
                if (source[i - 1] == target[j - 1])
                {
                    dp[i, j] = dp[i - 1, j - 1] + 1;
                    if (dp[i, j] > longest)
                        longest = dp[i, j];
                }
            }
        }

        return targetLength > 0 ? (double)longest / targetLength : 0.0;
    }

    private static double NormalizedLevenshteinSimilarity(string left, string right)
    {
        if (string.IsNullOrEmpty(left) && string.IsNullOrEmpty(right))
            return 1.0;
        if (string.IsNullOrEmpty(left) || string.IsNullOrEmpty(right))
            return 0.0;

        int distance = LevenshteinDistance(left, right);
        int maxLength = left.Length > right.Length ? left.Length : right.Length;
        if (maxLength == 0)
            return 1.0;

        return 1.0 - ((double)distance / maxLength);
    }

    private static int LevenshteinDistance(string left, string right)
    {
        int leftLength = left.Length;
        int rightLength = right.Length;
        int[,] matrix = new int[leftLength + 1, rightLength + 1];

        for (int i = 0; i <= leftLength; i++)
            matrix[i, 0] = i;
        for (int j = 0; j <= rightLength; j++)
            matrix[0, j] = j;

        for (int i = 1; i <= leftLength; i++)
        {
            for (int j = 1; j <= rightLength; j++)
            {
                int cost = left[i - 1] == right[j - 1] ? 0 : 1;
                int deletion = matrix[i - 1, j] + 1;
                int insertion = matrix[i, j - 1] + 1;
                int substitution = matrix[i - 1, j - 1] + cost;
                matrix[i, j] = Min3(deletion, insertion, substitution);
            }
        }

        return matrix[leftLength, rightLength];
    }

    private static int Min3(int a, int b, int c)
    {
        int min = a < b ? a : b;
        return min < c ? min : c;
    }

    private static Dictionary<string, Dictionary<string, int>> BuildSelectionCounters()
    {
        var counters = new Dictionary<string, Dictionary<string, int>>();
        for (int i = 0; i < KeyGroups.Count; i++)
        {
            KeyGroup group = KeyGroups[i];
            var valueCounter = new Dictionary<string, int>();
            for (int j = 0; j < group.Candidates.Count; j++)
                valueCounter[group.Candidates[j]] = 0;

            counters[group.KeyName] = valueCounter;
        }

        return counters;
    }

    private static void IncrementSelectionCount(
        Dictionary<string, Dictionary<string, int>> counters,
        string key,
        string value
    )
    {
        Dictionary<string, int> valueCounters;
        if (!counters.TryGetValue(key, out valueCounters))
            return;

        if (!valueCounters.ContainsKey(value))
            valueCounters[value] = 0;

        valueCounters[value] = valueCounters[value] + 1;
    }

    private static void PrintSelectionSummary(
        Dictionary<string, Dictionary<string, int>> valueSelectionCounts
    )
    {
        for (int i = 0; i < KeyGroups.Count; i++)
        {
            KeyGroup group = KeyGroups[i];
            RhinoApp.WriteLine("[WriteAttribute] Top selections for '{0}':", group.KeyName);
            Dictionary<string, int> counters = valueSelectionCounts[group.KeyName];

            for (int j = 0; j < group.Candidates.Count; j++)
            {
                string candidate = group.Candidates[j];
                int count = counters[candidate];
                if (count > 0)
                    RhinoApp.WriteLine("  - {0}: {1}", candidate, count);
            }
        }
    }
}
