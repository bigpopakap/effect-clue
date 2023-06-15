import * as E from '@effect/data/Either';
import * as HS from "@effect/data/HashSet";
import * as ST from "@effect/data/Struct";
import * as EQ from '@effect/data/Equal';
import * as EQV from '@effect/data/typeclass/Equivalence';
import * as P from '@effect/data/Predicate';
import * as H from '@effect/data/Hash';
import { pipe } from '@effect/data/Function';

import { HashSet_every, HashSet_getEquivalence, Refinement_and, Refinement_struct, Show, Show_isShow, Show_showHashSet, Show_symbol } from "../utils/ShouldBeBuiltin";

import * as Guess from './Guess';

type RawGuessSet = {
    readonly guesses: HS.HashSet<Guess.Guess>;
}

export type GuessSet = EQ.Equal & Show & RawGuessSet;

export const isGuessSet: P.Refinement<unknown, GuessSet> =
    pipe(
        Refinement_struct({
            guesses: pipe(
                HS.isHashSet,
                P.compose(HashSet_every(Guess.isGuess)),
            ),
        }),

        Refinement_and(EQ.isEqual),
        Refinement_and(Show_isShow),
    );

export const Equivalence: EQV.Equivalence<GuessSet> = ST.getEquivalence({
    guesses: HashSet_getEquivalence(Guess.Equivalence),
});

export const empty: GuessSet =
    Object.freeze({
        guesses: HS.empty(),

        [Show_symbol](): string {
            return Show_showHashSet(this.guesses);
        },

        [EQ.symbol](that: EQ.Equal): boolean {
            return isGuessSet(that) && Equivalence(this, that);
        },

        [H.symbol](): number {
            return H.structure({
                ...this
            });
        },
    });

export const add = (newGuess: Guess.Guess) =>
                (initialSet: GuessSet):
                GuessSet =>
    ST.evolve(initialSet, {
        guesses: HS.add(newGuess)
    });

export interface ValidatedGuessSet extends GuessSet {
    validated: true;
}

export const validate = (guessSet: GuessSet): E.Either<string[], ValidatedGuessSet> =>
    E.right(
        Object.freeze({
            ...guessSet,
            validated: true,
        })
    );