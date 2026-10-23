import { PlayerInfo, PlayerType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { setup } from "../../util/Setup";
import { executeTicks } from "../../util/utils";

describe("Solo atomic blast AREA cost and silo accounting", () => {
  const playerInfo = () => [
    new PlayerInfo("player", PlayerType.Human, "test-client", "test-player"),
  ];

  it("charges $1.5 million for one 2x-area atomic bomb and consumes only one silo launch", async () => {
    const game = await setup("big_plains", {
      startingGold: 10_000_000,
      instantBuild: true,
      virtualWorldAreaMultiplier: 100,
      specialOptions: { atomicMultiplier: true },
    }, playerInfo());
    const player = game.player("test-player");
    player.conquer(game.ref(1, 1));
    player.buildUnit(UnitType.MissileSilo, game.ref(1, 1), {});
    const previousGold = player.gold();
    const previousSilos = player.units(UnitType.MissileSilo).length;
    const execution = new NukeExecution(
      UnitType.AtomBomb, player, game.ref(150, 150), null, -1, 0, true, 2,
    );
    game.addExecution(execution);
    executeTicks(game, 2);
    expect(execution.getNuke()).not.toBeNull();
    expect(execution.getNuke()!.nukeState().blastMultiplier).toBe(2);
    expect(previousGold - player.gold()).toBe(1_500_000n);
    expect(player.units(UnitType.MissileSilo)).toHaveLength(previousSilos);
    expect(player.units(UnitType.AtomBomb)).toHaveLength(1);
  });

  it("refuses a 2x-area atomic launch when the total price cannot be paid", async () => {
    const game = await setup("big_plains", {
      startingGold: 2_000_000,
      instantBuild: true,
      virtualWorldAreaMultiplier: 100,
      specialOptions: { atomicMultiplier: true },
    }, playerInfo());
    const player = game.player("test-player");
    player.conquer(game.ref(1, 1));
    player.buildUnit(UnitType.MissileSilo, game.ref(1, 1), {});
    const goldBefore = player.gold();
    expect(goldBefore).toBe(1_000_000n);
    const execution = new NukeExecution(
      UnitType.AtomBomb, player, game.ref(150, 150), null, -1, 0, true, 2,
    );
    game.addExecution(execution);
    executeTicks(game, 2);
    expect(execution.getNuke()).toBeNull();
    expect(player.gold()).toBe(goldBefore);
    expect(player.units(UnitType.MissileSilo)).toHaveLength(1);
  });
});
