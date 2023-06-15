import * as E from '@effect/data/Either';
import * as H from '@effect/data/Hash';
import * as EQ from "@effect/data/Equal";
import * as ST from "@effect/data/Struct";
import * as S from '@effect/data/String';
import * as P from '@effect/data/Predicate';
import * as EQV from '@effect/data/typeclass/Equivalence';
import { Refinement_and, Refinement_struct, Show, Show_isShow, Show_show, Show_symbol } from '../utils/ShouldBeBuiltin';
import { pipe } from '@effect/data/Function';

type RawPlayer = {
    readonly label: string;
}

export type Player = EQ.Equal & Show & RawPlayer;

export const isPlayer: P.Refinement<unknown, Player> =
    pipe(
        Refinement_struct({
            label: P.isString,
        }),

        Refinement_and(EQ.isEqual),
        Refinement_and(Show_isShow),
    );

export const Equivalence: EQV.Equivalence<Player> = ST.getEquivalence({
    label: S.Equivalence,
});

export const create = (
    player: RawPlayer,
): E.Either<string, Player> =>
    E.right({
        ...player,

        [Show_symbol](): string {
            return `${Show_show(this.label)}`;
        },

        [EQ.symbol](that: EQ.Equal): boolean {
            return isPlayer(that) && Equivalence(this, that);
        },

        [H.symbol](): number {
            return H.structure({
                ...this
            });
        },
    });