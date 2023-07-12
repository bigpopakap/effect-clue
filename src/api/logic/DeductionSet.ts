
import { D, HM, B, T, CTX, BOOL, HS, E, SG, MON, ST } from '../utils/effect/EffectImports';
import { pipe, constant, compose } from '@effect/data/Function';
import { Struct_get, HashSet_of, Brand_refinedEffect, HashMap_setOrUpdate } from '../utils/effect/Effect';

import { Card, Player, Guess } from '../objects';
import { Game, CardOwner } from '../game';

import * as Range from './utils/Range';
import * as ConclusionMap from './utils/ConclusionMap';
import * as OwnershipOfCard from './utils/OwnershipOfCard';
import * as Conclusion from './utils/Conclusion';

export interface DeductionSet extends D.Case {
    _tag: "DeductionSet";
    numCards: ConclusionMap.ValidatedConclusionMap<Player.Player, Range.Range>;
    ownership: ConclusionMap.ValidatedConclusionMap<D.Data<[CardOwner.CardOwner, Card.Card]>, boolean>;
    refuteCards: ConclusionMap.ValidatedConclusionMap<Guess.Guess, HM.HashMap<Card.Card, 'owned' | 'maybe'>>;
};

export const DeductionSet = D.tagged<DeductionSet>("DeductionSet");

export type ValidatedDeductionSet = DeductionSet & B.Brand<'ValidatedDeductionSet'>;

export const ValidatedDeductionSet = Brand_refinedEffect<ValidatedDeductionSet, Game.Game>(
    T.gen(function* ($) {
        return [
            // TODO actually validate the deductions
            // - all Cards and Players actually exist in the game
            // - all Guesses actaully exist in the Game
            // - numCards cannot exceed total number of cards (minus whatever is in the case file) - where do we read that info from?
            // - the number of known owned/unowned cards for a player cannot be outside their numCards range
            // - card can be owned by at most 1 owner
            // - casefile can own at most 1 of each card type
            // - refuteCards must satisfy this requirement
            //   - {player's known owned cards} & {guessed cards} ==> "(owned)"
            //   - {player's unknown ownerships} & {guess cards} ==> "(maybe)"
        ];
    }),
);

export const Tag = CTX.Tag<ValidatedDeductionSet>();

export const empty: ValidatedDeductionSet =
    pipe(
        DeductionSet({
            numCards: ConclusionMap.empty(),
            ownership: ConclusionMap.empty(),
            refuteCards: ConclusionMap.empty(),
        }),

        ValidatedDeductionSet,

        // We just need an empty game
        T.provideService(Game.Tag, Game.emptyStandard),

        // If creating an empty deduction set errors, it is a defects in the underlying code,
        // not tagged errors that should be handled by the user
        T.runSync,
    );

// TODO store this on the ValidatedDeductionSet itself, rather than recomputing it each time
export const getOwnershipByCard = (
    deductions: ValidatedDeductionSet,
): HM.HashMap<Card.Card, OwnershipOfCard.OwnershipOfCard> =>
    pipe(
        // Pluck out the actual HashMap we care about
        deductions,
        Struct_get('ownership'),

        // We don't care about the deductions and reasons, just whether its owned or not
        HM.map(({ answer }) => answer),

        HM.reduceWithIndex(
            HM.empty(),

            (ownershipByCard, isOwned, [owner, card]) => {
                const newOwnership = pipe(
                    isOwned,

                    // TODO make better constructors for these
                    BOOL.match(
                        constant(OwnershipOfCard.OwnershipOfUnownedCard({
                            nonOwners: HashSet_of(owner),
                        })),

                        constant(OwnershipOfCard.OwnershipOfOwnedCard({
                            owner,
                            nonOwners: HS.empty(),
                        })),
                    ),
                );

                return HashMap_setOrUpdate(
                    card,

                    // If this card doesn't exist in the map yet
                    constant(newOwnership),

                    // If we already have ownership information for the card
                    compose(OwnershipOfCard.combine(newOwnership), E.getOrThrow),
                )(
                    ownershipByCard,
                )
            },
        )
    );

// TODO store this on the ValidatedDeductionSet itself, rather than recomputing it each time
export const getOwnershipByOwner = (
    deductions: ValidatedDeductionSet,
): HM.HashMap<CardOwner.CardOwner, OwnershipOfOwner.ValidatedOwnershipOfOwner> =>
    pipe(
        // Pluck out the actual HashMap we care about
        deductions,
        Struct_get('ownership'),

        // We don't care about the deductions and reasons, just whether its owned or not
        HM.map(({ answer }) => answer),

        HM.reduceWithIndex(
            HM.empty(),

            (ownershipByOwner, isOwned, [owner, card]) =>
                HashMap_setOrUpdate(
                    owner,

                    // If this card doesn't exist in the map yet
                    constant(pipe(
                        OwnershipOfOwner.empty,
                        OwnershipOfOwner.set(card, isOwned),
                        E.getOrThrow
                    )),

                    // If we already have ownership information for the card
                    flow(OwnershipOfOwner.set(card, isOwned), E.getOrThrow)
                )(
                    ownershipByOwner
                ),
        )
    );

export type Modification = ((deductions: ValidatedDeductionSet) => T.Effect<Game.Game, B.Brand.BrandErrors, ValidatedDeductionSet>);

export const identity: Modification =
    T.succeed;

export const ModificationSemigroup: SG.Semigroup<Modification> =
    SG.make((modifyFirst, modifySecond) => (first) => T.gen(function* ($) {
        const second = yield* $(modifyFirst(first));
        return yield* $(modifySecond(second));
    }));

export const ModificationMonoid: MON.Monoid<Modification> = MON.fromSemigroup(
    ModificationSemigroup,
    identity,
);

export const modifyAddNumCards =
        (player: Player.Player, [minNumCards, maxNumCards]: [number, number?], reason: Conclusion.Reason):
        Modification =>
    (deductions) => pipe(
        deductions,
        ST.pick('numCards', 'ownership', 'refuteCards'),

        ST.evolve({
            numCards: (numCardsMap) => T.gen(function* ($) {
                const newRange = yield* $(Range.decodeEither([minNumCards, maxNumCards]));
                const updateNumCards = ConclusionMap.setMergeOrFail(player, newRange, HashSet_of(reason));
                return yield* $(updateNumCards(numCardsMap));
            }),
            ownership: (_) => E.right(_),
            refuteCards: (_) => E.right(_),
        }),
        E.struct,

        T.map(DeductionSet),
        T.flatMap(ValidatedDeductionSet),
    );

export const modifyAddOwnership =
        (owner: CardOwner.CardOwner, card: Card.ValidatedCard, isOwned: boolean, reason: Conclusion.Reason):
        Modification =>
    flow(
        ST.pick('numCards', 'ownership', 'refuteCards'),

        ST.evolve({
            numCards: (_) => E.right(_),
            ownership: ConclusionMap.setMergeOrFail(D.array([owner, card] as const), isOwned, HashSet_of(reason)),
            refuteCards: (_) => E.right(_),
        }),
        E.struct,

        T.map(DeductionSet),
        T.flatMap(ValidatedDeductionSet),
    );

export const modifySetRefuteCards =
        (guess: Guess.ValidatedGuess, possibleCards: HM.HashMap<Card.ValidatedCard, 'owned' | 'maybe'>, reason: Conclusion.Reason):
        Modification =>
    flow(
        ST.pick('numCards', 'ownership', 'refuteCards'),

        ST.evolve({
            numCards: (_) => E.right(_),
            ownership: (_) => E.right(_),
            refuteCards: ConclusionMap.setMergeOrOverwrite(guess, possibleCards, HashSet_of(reason)),
        }),
        E.struct,

        T.map(DeductionSet),
        T.flatMap(ValidatedDeductionSet),
    );

export const modifyCombine = (
    second: DeductionSet,
): Modification => (first) =>
    pipe(
        first,

        ST.pick('numCards', 'ownership', 'refuteCards'),

        ST.evolve({
            numCards: ConclusionMap.combineMergeOrFail(second.numCards),
            ownership: ConclusionMap.combineMergeOrFail(second.ownership),
            refuteCards: ConclusionMap.combineMergeOrFail(second.refuteCards),
        }),
        E.struct,

        T.map(DeductionSet),
        T.flatMap(ValidatedDeductionSet),
    );