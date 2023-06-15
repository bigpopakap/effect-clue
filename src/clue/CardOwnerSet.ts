import * as E from '@effect/data/Either';
import * as HS from "@effect/data/HashSet";
import * as ST from "@effect/data/Struct";
import * as EQ from '@effect/data/Equal';
import * as EQV from '@effect/data/typeclass/Equivalence';
import * as P from '@effect/data/Predicate';
import * as H from '@effect/data/Hash';
import { pipe } from '@effect/data/Function';

import { HashSet_every, HashSet_getEquivalence, Refinement_and, Refinement_struct, Show, Show_isShow, Show_showHashSet, Show_symbol } from '../utils/ShouldBeBuiltin';

import * as CardOwner from './CardOwner';

type RawCardOwnerSet = {
    readonly owners: HS.HashSet<CardOwner.CardOwner>;
}

export type CardOwnerSet = EQ.Equal & Show & RawCardOwnerSet;

export const isCardOwnerSet: P.Refinement<unknown, CardOwnerSet> =
    pipe(
        Refinement_struct({
            owners: pipe(
                HS.isHashSet,
                P.compose(HashSet_every(CardOwner.isCardOwner)),
            ),
        }),

        Refinement_and(EQ.isEqual),
        Refinement_and(Show_isShow),
    );

export const Equivalence: EQV.Equivalence<CardOwnerSet> = ST.getEquivalence({
    owners: HashSet_getEquivalence(CardOwner.Equivalence),
});

export const empty: CardOwnerSet =
    Object.freeze({
        owners: HS.empty(),

        [Show_symbol](): string {
            return Show_showHashSet(this.owners);
        },

        [EQ.symbol](that: EQ.Equal): boolean {
            return isCardOwnerSet(that) && Equivalence(this, that);
        },

        [H.symbol](): number {
            return H.structure({
                ...this
            });
        },
    });

export const add = (newOwner: CardOwner.CardOwner) =>
                (initialSet: CardOwnerSet):
                CardOwnerSet =>
    ST.evolve(initialSet, {
        owners: HS.add(newOwner),
    });

export interface ValidatedCardOwnerSet extends CardOwnerSet {
    validated: true;
}

export const validate = (cardOwnerSet: CardOwnerSet): E.Either<string[], ValidatedCardOwnerSet> =>
    E.right(
        Object.freeze({
            ...cardOwnerSet,
            validated: true,
        })
    );