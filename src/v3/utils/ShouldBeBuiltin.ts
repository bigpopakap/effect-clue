import * as E from '@effect/data/Either';
import * as HS from '@effect/data/HashSet';
import * as HM from '@effect/data/HashMap';
import * as O from '@effect/data/Option';
import * as ROA from '@effect/data/ReadonlyArray';
import * as SG from '@effect/data/typeclass/Semigroup'
import * as MN from '@effect/data/typeclass/Monoid'
import * as EQ from '@effect/data/Equal';
import * as EQV from '@effect/data/typeclass/Equivalence';
import * as P from '@effect/data/Predicate';
import { pipe, identity, flow, constant, constTrue } from '@effect/data/Function'

export const String_surroundWith = (pre: string, post = pre) => (str: string): string =>
    `${pre}${str}${post}`;

export type Endomorphism<A> = (a: A) => A

export const Endomorphism_getMonoid = <A>(): MN.Monoid<Endomorphism<A>> =>
  MN.fromSemigroup(
    SG.make((f, g) => flow(f, g)),
    identity
  );

// TODO replace this with some in-built util that does the same thing
export const eitherApply = <E, A>(maybeFn: E.Either<E, (a: A) => A>): ((a: A) => E.Either<E, A>) =>
    null;

export const HashSet_every = <A, B extends A>(refineValue: P.Refinement<A, B>): P.Refinement<HS.HashSet<A>, HS.HashSet<B>> =>
    (hashSet): hashSet is HS.HashSet<B> =>
        HS.every(hashSet, refineValue);

// TODO replace this with some in-built util that does the same thing
export const HashSet_getEquivalence = <A>(EQVA: EQV.Equivalence<A>): EQV.Equivalence<HS.HashSet<A>> =>
    null;

export const HashMap_setOrFail = <K, V>(key: K, value: V) => (map: HM.HashMap<K, V>): E.Either<V, HM.HashMap<K, V>> =>
    pipe(
        // Try getting the existing value
        HM.get(map, key),

        O.match(
            // The value doesn't already exist, so set it
            () => E.right(HM.set(map, key, value)),

            // The value already exists, so fail
            E.left,
        ),
    );

export declare const Show_symbol: unique symbol;

export interface Show {
    [Show_symbol](): string;
}

export const Show_isShow = <A>(thing: A): thing is A & Show =>
    P.isNotNullable(thing) &&
    P.isObject(thing) &&
    Show_symbol in thing &&
    P.isNotNullable(thing[Show_symbol]) &&
    typeof thing[Show_symbol] === 'function';

export const Show_show = (showable: Show): string =>
    showable[Show_symbol]();

export const Show_showOption: <A extends Show>(option: O.Option<A>) => string =
    O.match(
        constant('None'),
        flow(Show_show, String_surroundWith('Some(', ')')),
    );

export const Show_showHashSet: <A extends Show>(hashSet: HS.HashSet<A>) => string =
    flow(
        // Convert the values to an array
        HS.values,
        ROA.fromIterable, // TODO ROA.map should be able to handle iterables

        // Show each element
        ROA.map(Show_show),

        // Concatenate it all into one string
        ROA.join(", "),
        String_surroundWith('{ ', ' }'),
    );

export const HashMap_separateV = <V>(valuePredicate: P.Predicate<V>) => <K>(map: HM.HashMap<K, V>): [falseMap: HM.HashMap<K, V>, trueMap: HM.HashMap<K, V>] =>
    [
        // False map
        pipe(
            map,
            HM.filter(P.not(valuePredicate)),
        ),

        // True map
        pipe(
            map,
            HM.filter(valuePredicate),
        ),
    ];

export const Predicate_Refinement_struct =
    <R extends Record<string | number | symbol, unknown>>(refinements: { [k in keyof R]: P.Refinement<unknown, R[k]>}):
    P.Refinement<unknown, R> =>
        pipe(
            P.isRecord,

            P.compose((obj): obj is R => {
                // TODO
            }),
        );

// Merged in this PR: https://github.com/Effect-TS/data/pull/361
export const Refinement_and:
        <A, C extends A>(that: P.Refinement<A, C>) =>
        <B extends A>(self: P.Refinement<A, B>) =>
        P.Refinement<A, B & C> =
    P.and as any;

export const Refinement_or:
    <A, C extends A>(that: P.Refinement<A, C>) =>
    <B extends A>(self: P.Refinement<A, B>) =>
    P.Refinement<A, B | C> =
        P.or as any;

export const Equivalence_constTrue: EQV.Equivalence<unknown> =
    EQV.make(constTrue);

export const Equals_getRefinement1 = <A extends EQ.Equal, const M extends A>(model: M): P.Refinement<A, M> =>
    (a): a is M =>
        // TODO is there a function that avoids this manual EQ.symbol?
        model[EQ.symbol](a);

export const Equals_getRefinement2 = <A, const M extends A>(model: M, eqvA: EQV.Equivalence<A>): P.Refinement<A, M> =>
    (a): a is M =>
        // TODO is there a function that avoids this manual EQ.symbol?
        eqvA(model, a);
