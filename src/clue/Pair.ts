import * as H from '@effect/data/Hash';
import * as EQ from "@effect/data/Equal";
import * as ST from "@effect/data/Struct";
import * as EQV from '@effect/data/typeclass/Equivalence';
import { Refinement_struct, Refinement_and } from '../utils/ShouldBeBuiltin';
import * as P from '@effect/data/Predicate';
import { pipe } from '@effect/data/Function';

type RawPair<A, B> = {
    readonly first: A;
    readonly second: B;
};

export type Pair<A, B> = EQ.Equal & RawPair<A, B>;

export const getRefinement = <A, B>(
    refFirst: P.Refinement<unknown, A>,
    refSecond: P.Refinement<unknown, B>,
): P.Refinement<unknown, Pair<A, B>> =>
    pipe(
        Refinement_struct({
            first: refFirst,
            second: refSecond,
        }),

        Refinement_and(EQ.isEqual),
    );

export const isPair: P.Refinement<unknown, Pair<unknown, unknown>> =
    getRefinement(P.isUnknown, P.isUnknown);

export const Equivalence: EQV.Equivalence<Pair<unknown, unknown>> = ST.getEquivalence({
    first: EQ.equivalence(),
    second: EQ.equivalence(),
});

export const create = <A, B>(
    pair: RawPair<A, B>,
): Pair<A, B> =>
    Object.freeze({
        ...pair,

        toString() {
           return `('${this.first}', ${this.second})`;
        },

        [EQ.symbol](that: EQ.Equal): boolean {
            return isPair(that) && Equivalence(this, that);
        },

        [H.symbol](): number {
            return H.structure({
                ...this
            });
        },
    });

// TODO does this short-hand make sense? Can we reduce the number of properties in each object instead?
export const getFirst = <A>(pair: Pair<A, unknown>): A =>
    pair.first;

// TODO does this short-hand make sense? Can we reduce the number of properties in each object instead?
export const getSecond = <B>(pair: Pair<unknown, B>): B =>
    pair.second;
