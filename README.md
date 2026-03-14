# graphhopper

## Rhino plugin toolbar command

The Rhino plugin includes a command named `WriteAttribute`.

- Command name in Rhino: `_WriteAttribute`
- Toolbar button label: `Write Attribute`
- Toolbar button macro: `! _WriteAttribute`

`WriteAttribute` reads each object's layer hierarchy (current layer plus parent layers), finds the closest match in the built-in vocab lists, and writes three User Text keys:
- `Building Element`
- `Functional Role`
- `Material System`

`WriteAttribute` now uses alias-first matching with fuzzy fallback:
- Alias dictionaries are applied first (strong priority).
- If no alias matches, typo-tolerant fuzzy scoring is used.

Edit vocab lists, aliases, and scoring logic in `rhino_plugin/AutoGraph/WriteAttributeCommand.cs`:
- `FunctionalRoleAliases` contains explicit aliases.
- `Building Element` and `Material System` aliases are auto-generated starters and can be refined.

## Autograph toolbar setup

Create a Rhino toolbar named `Autograph` with six buttons:

1. In Rhino, run `Toolbar`.
2. Create a new toolbar named `Autograph`.
3. Add button 1:
   - Button text: `Create Layers`
   - Tooltip: `Create standard AutoGraph layers`
   - Left-click command: `! _CreateLayers`
4. Add button 2:
   - Button text: `Write Attribute`
   - Tooltip: `Write AutoGraph attributes from layer hierarchy`
   - Left-click command: `! _WriteAttribute`
5. Add button 3:
   - Button text: `Create Graph`
   - Tooltip: `Create graph from the current Rhino model`
   - Left-click command: `! _CreateGraph`
6. Add button 4:
   - Button text: `Start Listener`
   - Tooltip: `Start Rhino object change listener`
   - Left-click command: `! _StartListener`
7. Add button 5:
   - Button text: `Stop Listener`
   - Tooltip: `Stop Rhino object change listener`
   - Left-click command: `! _StopListener`
8. Add button 6:
   - Button text: `Inspect Collision`
   - Tooltip: `Inspect mesh collisions and output report`
   - Left-click command: `! _InspectCollision`

## Verify toolbar buttons

- Click `Create Layers` and confirm Rhino creates the expected layer structure.
- Click `Write Attribute` and confirm object User Text includes:
  - `Building Element`
  - `Functional Role`
  - `Material System`
- Click `Create Graph` and confirm Rhino runs `_CreateGraph`.
- Click `Start Listener` and confirm Rhino runs `_StartListener` (executes `rhino_scripts/run_start_listener.py`).
- Click `Stop Listener` and confirm Rhino runs `_StopListener` (executes `rhino_scripts/run_stop_listener.py`).
- Click `Inspect Collision` and confirm Rhino runs `_InspectCollision` (executes `rhino_scripts/utils/collision_utils.py`).