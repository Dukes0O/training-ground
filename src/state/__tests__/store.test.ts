import { beforeEach, describe, expect, it } from "vitest";
import type { Drill } from "../../model/types";
import { redo, undo, useEditor } from "../store";

function fixture(): Drill {
  return {
    schemaVersion: 1,
    id: "test",
    title: "Test",
    pitch: { format: "grid", overrides: { length: 20, width: 20 } },
    entities: [
      { kind: "player", id: "p1", team: "home", number: 7 },
      { kind: "player", id: "p2", team: "away", number: 9 },
      { kind: "ball", id: "ball" },
      { kind: "arrow", id: "a1", style: "pass", from: { ref: "p1" }, to: { ref: "p2" } },
    ],
    steps: [
      { positions: { p1: { x: 5, y: 5 }, p2: { x: 15, y: 15 }, ball: { x: 6, y: 6 } } },
      { durationMs: 1000, positions: { p1: { x: 10, y: 5, via: [{ x: 7, y: 3 }], ease: "linear" } } },
      { durationMs: 1000, positions: { ball: { x: 12, y: 12 } } },
    ],
  };
}

function load(drill = fixture()) {
  useEditor.getState().applyLoadedDrill(drill, 0);
  useEditor.temporal.getState().clear();
}

beforeEach(() => load());

describe("deleteStep cursor arithmetic", () => {
  it("keeps the cursor on the same content when deleting an earlier step", () => {
    useEditor.getState().jumpToStep(2);
    useEditor.getState().deleteStep(1);
    expect(useEditor.getState().currentStep).toBe(1); // old step 2 is now step 1
  });

  it("does not double-decrement when deleting the last step while viewing it", () => {
    useEditor.getState().jumpToStep(2);
    useEditor.getState().deleteStep(2);
    expect(useEditor.getState().currentStep).toBe(1);
  });

  it("stays put when deleting a later step", () => {
    useEditor.getState().jumpToStep(0);
    useEditor.getState().deleteStep(2);
    expect(useEditor.getState().currentStep).toBe(0);
  });
});

describe("removeSelected anchor handling", () => {
  it("converts arrows anchored to a deleted entity into fixed points", () => {
    useEditor.getState().select(["p2"]);
    useEditor.getState().removeSelected();
    const drill = useEditor.getState().drill;
    const arrow = drill.entities.find((e) => e.id === "a1");
    expect(arrow).toBeDefined();
    expect(arrow && "to" in arrow && arrow.to).toEqual({ x: 15, y: 15 });
    expect(arrow && "from" in arrow && arrow.from).toEqual({ ref: "p1" }); // untouched
  });
});

describe("nudgeSelection on forward-filled poses", () => {
  it("creates an explicit keyframe from the inherited pose", () => {
    useEditor.getState().jumpToStep(2);
    useEditor.getState().select(["p1"]); // p1 has no explicit pose at step 2 before densify-on-edit
    // ensure sparse: remove any explicit entry first
    useEditor.getState().resetPoseAtCurrentStep("p1");
    useEditor.getState().nudgeSelection(1, 0);
    const pose = useEditor.getState().drill.steps[2].positions.p1;
    expect(pose).toBeDefined();
    expect(pose.x).toBeCloseTo(11); // inherited 10 from step 1, nudged +1
  });
});

describe("duplicateStep", () => {
  it("strips via/ease from the duplicated step's poses", () => {
    useEditor.getState().duplicateStep(1);
    const copy = useEditor.getState().drill.steps[2];
    expect(copy.positions.p1.via).toBeUndefined();
    expect(copy.positions.p1.ease).toBeUndefined();
    expect(copy.positions.p1.x).toBe(10);
  });
});

describe("undo/redo cursor reconciliation", () => {
  it("clamps currentStep after undoing an added step", () => {
    useEditor.getState().jumpToStep(2);
    useEditor.getState().addStepAfter(2);
    expect(useEditor.getState().currentStep).toBe(3);
    undo();
    expect(useEditor.getState().drill.steps).toHaveLength(3);
    expect(useEditor.getState().currentStep).toBe(2);
    redo();
    expect(useEditor.getState().drill.steps).toHaveLength(4);
  });

  it("prunes selection of entities that no longer exist after undo-redo", () => {
    useEditor.getState().addEquipment("cone", { x: 3, y: 3 });
    const coneId = useEditor.getState().selection[0];
    undo();
    expect(useEditor.getState().drill.entities.some((e) => e.id === coneId)).toBe(false);
    expect(useEditor.getState().selection).toHaveLength(0);
  });
});

describe("setPitchFormat clamping", () => {
  it("pulls out-of-bounds pieces into the new pitch", () => {
    const big = fixture();
    big.pitch = "11v11";
    big.steps[0].positions.p2 = { x: 95, y: 60 };
    load(big);
    useEditor.getState().setPitchFormat("8v8"); // 60 x 40
    const pose = useEditor.getState().drill.steps[0].positions.p2;
    expect(pose.x).toBeLessThanOrEqual(63);
    expect(pose.y).toBeLessThanOrEqual(43);
  });
});
