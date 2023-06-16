import * as EQ from '@effect/data/Equal';
import * as P from '@effect/data/Predicate';
import * as EQV from '@effect/data/typeclass/Equivalence';
import * as ST from '@effect/data/Struct';
import * as H from '@effect/data/Hash';
import { pipe } from '@effect/data/Function';

import { Refinement_and, Refinement_struct } from '../utils/ShouldBeBuiltin';

import * as CardSet from "./CardSet";
import * as CardOwnerSet from "./CardOwnerSet";

type RawGameSetup = {
    cards: CardSet.CardSet;
    owners: CardOwnerSet.CardOwnerSet;
};

export type GameSetup = EQ.Equal & RawGameSetup;

export const isGameSetup: P.Refinement<unknown, GameSetup> =
    pipe(
        Refinement_struct({
            cards: CardSet.isCardSet,
            owners: CardOwnerSet.isCardOwnerSet,
        }),

        Refinement_and(EQ.isEqual),
    );

export const Equivalence: EQV.Equivalence<GameSetup> = ST.getEquivalence({
    cards: CardSet.Equivalence,
    owners: CardOwnerSet.Equivalence,
});

export const create = (gameSetup: RawGameSetup): GameSetup =>
    ({
        ...gameSetup,

        toString() {
            return `Game setup with cards ${this.cards} and players ${this.owners}`;
        },

        [EQ.symbol](that: EQ.Equal): boolean {
            return isGameSetup(that) && Equivalence(this, that);
        },

        [H.symbol](): number {
            return H.structure({
                ...this
            });
        },
    });

export const empty: GameSetup =
    create({
        cards: CardSet.empty,
        owners: CardOwnerSet.empty,
    });
