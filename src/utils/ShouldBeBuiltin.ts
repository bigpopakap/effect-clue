import { SG, EQV, P, O, BOOL, MON, HS, HM, TU, ROA, T, E, B, AP } from "./EffectImports";
import { constTrue, pipe, flow, identity, apply } from "@effect/data/Function";

export const Function_getSemigroup =
    <B>(SGB: SG.Semigroup<B>) =>
    <A = never>(): SG.Semigroup<(a: A) => B> =>
    SG.make(
        (f, g) => (a) => SGB.combine(f(a), g(a))
    );

export const Equivalence_constTrue: EQV.Equivalence<unknown> =
    constTrue;

export const Option_fromRefinement = <A, B extends A>(refinement: P.Refinement<A, B>) => (a: A): O.Option<B> =>
    pipe(
        refinement(a),

        BOOL.match(
            // The value doesn't pass the refinement
            () => O.none(),

            () => O.some(a as B),
        ),
    );

export const Option_fromPredicate: <A>(predicate: P.Predicate<A>) => (a: A) => O.Option<A> =
    Option_fromRefinement as any;

export const Either_fromRefinement = <A, B extends A, E>(refinement: P.Refinement<A, B>, onFalse: (value: Exclude<A, B>) => E) => (a: A): E.Either<E, B> =>
    pipe(
        refinement(a),

        BOOL.match(
            // The value doesn't pass the refinement
            () => E.left(onFalse(a as Exclude<A, B>)),

            () => E.right(a as B),
        ),
    );

export const Either_fromPredicate: <A, E>(refinement: P.Predicate<A>, onFalse: (value: A) => E) => (a: A) => E.Either<E, A> =
    Either_fromRefinement as any;

export type Endomorphism<A> = (a: A) => A

export const Endomorphism_getMonoid = <A>(): MON.Monoid<Endomorphism<A>> =>
  MON.fromSemigroup(
    SG.make((f, g) => flow(f, g)),
    identity
  );

export const HashSet_of = <A>(value: A): HS.HashSet<A> =>
    HS.fromIterable([value]);

export const HashSet_fromHashMapMulti = <K, V>(hashMap: HM.HashMap<K, HS.HashSet<V>>): HS.HashSet<[K, V]> =>
    pipe(
        hashMap,

        HM.mapWithIndex((hashSet, key) =>
            HS.map(hashSet, (value) =>
                TU.tuple(key, value),
            ),
        ),

        HM.values,

        ROA.reduce(
            HS.empty<[K, V]>(),
            (unionSet, nextSet) => HS.union(unionSet, nextSet),
        ),
    );

export const Effect_getSemigroupCombine = <A, E, R>(combine: (a: A, b: A) => T.Effect<R, E, A>): SG.Semigroup<T.Effect<R, E, A>> =>
    SG.make((first, second) => T.gen(function* ($) {
        const firstValue = yield* $(first);
        const secondValue = yield* $(second);

        return yield* $(combine(firstValue, secondValue));
    }));

export const HashSet_isSize = <A>(size: number): P.Predicate<HS.HashSet<A>> =>
    (hashSet) =>
        HS.size(hashSet) === size;

export const Struct_get = <S, Key extends keyof S>(
    key: Key,
) => (
    s: S,
): S[Key] =>
    s[key];

export const Either_validate = <A, E, B>(validations: readonly ((input: A) => E.Either<E, B>)[]) => (input: A): E.Either<E[], B[]> =>
    pipe(
        ROA.map(validations, apply(input)),

        ROA.reduce<E.Either<E[], B[]>, E.Either<E, B>>(
            E.right([]),

            (overallResult, nextValidationResult) => pipe(
                overallResult,

                E.match(
                    // We already have an error
                    (errors) => pipe(
                        nextValidationResult,

                        E.match(
                            // Append the new error
                            (nextError) => E.left([...errors, nextError]),

                            // It doesn't matter if we have a success, because we're already in failures
                            () => E.left(errors),
                        ),
                    ),

                    // We have success
                    (values) => pipe(
                        nextValidationResult,

                        E.match(
                            // Switch us into the error channel with this first error
                            (nextError) => E.left([nextError]),

                            // Append the new value
                            (nextValue) => E.right([...values, nextValue]),
                        ),
                    ),
                ),
            ),
        ),
    );

export const Brand_refined = <Branded extends B.Brand<string | symbol>>(
    refinements: readonly ((unbranded: B.Brand.Unbranded<Branded>) => E.Either<B.Brand.BrandErrors, unknown>)[],
) => (
    unbranded: B.Brand.Unbranded<Branded>,
): E.Either<B.Brand.BrandErrors, Branded> =>
    pipe(
        unbranded,
        Either_validate(refinements),
        E.bimap(
            errors => B.errors(...errors),
            () => B.nominal<Branded>()(unbranded),
        ),
    );

export const Brand_refinedEffect = <Branded extends B.Brand<string | symbol>, R>(
    refinements: T.Effect<R, never, readonly ((unbranded: B.Brand.Unbranded<Branded>) => E.Either<B.Brand.BrandErrors, unknown>)[]>,
) => (
    unbranded: B.Brand.Unbranded<Branded>
): T.Effect<R, B.Brand.BrandErrors, Branded> =>
    pipe(
        refinements,

        T.flatMap(refinements =>
            Brand_refined(refinements)(unbranded),
        ),
    );

export const HashMap_setOrUpdate = <K, V>(
    key: K,
    set: () => V,
    update: (existing: V) => V,
) => (
    hashMap: HM.HashMap<K, V>
): HM.HashMap<K, V> =>
    pipe(
        // See if there's a value
        HM.get(hashMap, key),

        // Decide the updated value to set
        O.match(set, update),

        updatedValue => HM.set(hashMap, key, updatedValue),
    );
