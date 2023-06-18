import * as B from '@effect/data/Brand';
import * as O from '@effect/data/Option';
import * as E from '@effect/data/Either';
import * as ROA from '@effect/data/ReadonlyArray';
import * as T from '@effect/io/Effect';
import * as HS from '@effect/data/HashSet';
import * as ST from "@effect/data/Struct";
import * as EQ from '@effect/data/Equal';
import * as Match from "@effect/match";
import * as P from '@effect/data/Predicate';
import { flow, pipe } from '@effect/data/Function';

import { Endomorphism_getMonoid } from '../utils/ShouldBeBuiltin';

import * as Card from './Card';
import * as CardSet from './CardSet';
import * as Player from './Player';
import * as CaseFile from './CaseFile';
import * as CardOwnerSet from './CardOwnerSet';
import * as CardOwner from './CardOwner';
import * as Game from './Game';
import * as Guess from './Guess';
import * as GuessSet from './GuessSet';
import * as DeductionRule from './DeductionRule';
import * as Conclusion from './Conclusion';
import * as ConclusionMapSet from './ConclusionMapSet';

type RawCard = [string, string];

const parseCard: (card: RawCard) => E.Either<B.Brand.BrandErrors, Card.ValidatedCard> =
    flow(
        ([cardType, label]) => Card.Card({
            cardType,
            label,
        }),

        Card.ValidatedCard,
    );

export const setupCards = ({
    useStandard,
    extraCards: rawExtraCards = [],
}: {
    useStandard?: 'North America';
    extraCards?: RawCard[];
}): E.Either<B.Brand.BrandErrors, CardSet.ValidatedCardSet> =>
    E.gen(function* ($) {
        // Start with whatever standard set was selected
        const startingSet = pipe(
            Match.value(useStandard),

            // If no standard set is selected, leave the set untouched
            Match.when(undefined, () => CardSet.empty),
            
            // Otherwise, add the selected standard set
            Match.when('North America', () => CardSet.northAmerica),

            Match.exhaustive,
        );

        // Create the extra manual cards
        const extraCards = yield* $(
            E.validateAll(rawExtraCards, parseCard), 
            E.mapLeft(errors => B.errors(...errors)),
        );

        // Create our function to add all these extra cards
        const addExtraCards = pipe(
            extraCards,
            ROA.map(CardSet.add),
            Endomorphism_getMonoid<CardSet.CardSet>().combineAll,
        );

        return yield* $(
            startingSet,
            addExtraCards,
            CardSet.ValidatedCardSet,
        );
    });

type RawPlayer = [string];
type RawCaseFile = [string];

const parsePlayer: (player: RawPlayer) => E.Either<B.Brand.BrandErrors, Player.ValidatedPlayer> =
    flow(
        ([name]) => Player.Player({ name }),
        Player.ValidatedPlayer,
    );

const parseCaseFile: (caseFile: RawCaseFile) => E.Either<B.Brand.BrandErrors, CaseFile.ValidatedCaseFile> =
    flow(
        ([label]) => CaseFile.CaseFile({ label }),
        CaseFile.ValidatedCaseFile,
    );

export const setupCardOwners = ({
    players = [],
    caseFiles = [],
}: {
    players?: RawPlayer[];
    caseFiles?: RawCaseFile[];
}): E.Either<B.Brand.BrandErrors, CardOwnerSet.ValidatedCardOwnerSet> =>
    E.gen(function* ($) {
        // Create the players
        const playerOwners = yield* $(
            E.validateAll(
                players,

                flow(
                    parsePlayer,
                    E.map(player => CardOwner.CardOwnerPlayer({
                        player,
                    })),
                ),
            ),

            // Concat all the errors
            E.mapLeft(errors => B.errors(...errors)),
        );

        // Create the case files
        const caseFileOwners = yield* $(
            E.validateAll(
                caseFiles,

                flow(
                    parseCaseFile,
                    E.map(caseFile => CardOwner.CardOwnerCaseFile({
                        caseFile,
                    })),
                ),
            ),

            // Concat all the errors
            E.mapLeft(errors => B.errors(...errors)),
        );

        // Create our functiont to add all these owners
        const addAllOwners = pipe(
            playerOwners,
            ROA.appendAll(caseFileOwners),

            ROA.map(CardOwnerSet.add),
            Endomorphism_getMonoid<CardOwnerSet.CardOwnerSet>().combineAll,
        );

        return yield* $(
            CardOwnerSet.empty,
            addAllOwners,
            CardOwnerSet.ValidatedCardOwnerSet,
        );
    });

export const setupGame = ({
    cards = CardSet.empty,
    owners = CardOwnerSet.empty,
}: {
    cards?: CardSet.ValidatedCardSet;
    owners?: CardOwnerSet.ValidatedCardOwnerSet;
}): E.Either<B.Brand.BrandErrors, Game.Game> =>
    E.right(Game.Game({
        cards,
        owners,
    }));

export const provideGame = (game: Game.Game) =>
    T.provideService(Game.Tag, game);

export const setupKnownConclusions = ({
    knownNumCards: rawKnownNumCards = [],
    knownCardOwners: rawKnownCardOwners = [],
}: {
    knownNumCards?: readonly [RawPlayer, number][];
    knownCardOwners?: readonly [RawPlayer, RawCard][];
}): T.Effect<Game.Game, B.Brand.BrandErrors, ConclusionMapSet.ValidatedConclusionMapSet> =>
    T.gen(function* ($) {
        const knownNumCards = yield* $(
            E.validateAll(
                rawKnownNumCards,

                ([player, numCards]) => E.tuple(
                    parsePlayer(player),
                    E.right(numCards),
                ),
            ),

            // Concat all the errors
            E.mapLeft(errors => B.errors(...errors)),
        );

        const knownCardOwners = yield* $(
            E.validateAll(
                rawKnownCardOwners,

                ([player, card]) => E.tuple(
                    parsePlayer(player),
                    parseCard(card),
                ),
            ),

            // Concat all the errors
            E.mapLeft(errors => B.errors(...errors)),
        );

        // Create the function to add all these conclusions
        const addConclusions = pipe(
            ROA.map(knownNumCards, ([player, numCards]) =>
                ConclusionMapSet.modifyAddNumCards(
                    player,
                    numCards,
                    Conclusion.Reason({
                        level: 'observed',
                        explanation: 'Manually entered',
                    })
                ),
            ),

            ROA.appendAll(ROA.map(knownCardOwners, ([player, card]) =>
                ConclusionMapSet.modifyAddOwnership(
                    CardOwner.CardOwnerPlayer({ player }),
                    card,
                    true,
                    Conclusion.Reason({
                        level: 'observed',
                        explanation: 'Manually entered',
                    })
                ),
            )),

            ConclusionMapSet.ModificationMonoid.combineAll,
        );

        return yield* $(
            ConclusionMapSet.empty,
            addConclusions,
        );
    });

type RawGuess = {
    cards: RawCard[],
    guesser: RawPlayer,
    nonRefuters: RawPlayer[],
    refutation?: [
        RawPlayer,
        RawCard?
    ],
};

// TODO actually parse this!
const parseGuess = ({
    cards: rawCards,
    guesser: rawGuesser,
    nonRefuters: rawNonRefuters,
    refutation: rawRefutation,
}: RawGuess): T.Effect<Game.Game, B.Brand.BrandErrors, Guess.ValidatedGuess> =>
    T.gen(function* ($) {
        const cards = yield* $(
            E.validateAll(rawCards, parseCard),
            E.mapLeft(errors => B.errors(...errors)),
            E.map(HS.fromIterable),
        );

        const guesser = yield* $(parsePlayer(rawGuesser));

        const nonRefuters = yield* $(
            E.validateAll(rawNonRefuters, parsePlayer),
            E.mapLeft(errors => B.errors(...errors)),
            E.map(HS.fromIterable),
        );

        const refutation = yield* $(
            O.fromNullable(rawRefutation),

            O.map(flow(
                ([rawPlayer, rawCard]) => ({
                    refuter: rawPlayer,
                    card: rawCard,
                }),

                ST.evolve({
                    refuter: parsePlayer,
                    
                    card: flow(
                        O.fromNullable,
                        O.map(parseCard),
                        O.sequence(E.Applicative),
                    ),
                }),

                E.struct,
            )),

            O.sequence(E.Applicative),
        );

        return yield* $(
            Guess.Guess({
                cards,
                guesser,
                nonRefuters,
                refutation,
            }),

            Guess.ValidatedGuess,
        );
    });

export const setupGuesses = ({
    guesses: rawGuesses = [],
}: {
    guesses?: RawGuess[];
}): T.Effect<Game.Game, B.Brand.BrandErrors, GuessSet.ValidatedGuessSet> =>
    T.gen(function* ($) {
        // Create the guesses
        const guesses = yield* $(
            T.validateAll(rawGuesses, parseGuess),
            T.mapError(errors => B.errors(...errors)),
        );

        // Create our function to add all the guesses
        const addGuesses = pipe(
            guesses,
            ROA.map(GuessSet.add),
            Endomorphism_getMonoid<GuessSet.GuessSet>().combineAll,
        );

        return yield* $(
            GuessSet.empty,
            addGuesses,
            GuessSet.ValidatedGuessSet,
        );
    });

export const provideGuesses = (guesses: GuessSet.ValidatedGuessSet) =>
    T.provideService(GuessSet.Tag, guesses);

const ALL_DEDUCTION_RULES = [
    'cardIsHeldAtMostOnce',
    'cardIsHeldAtLeastOnce',
    'cardIsHeldExactlyOnce',
    'playerHasAtMostNumCards',
    'playerHasAtLeastNumCards',
    'playerHasExactlyNumCards',
    'caseFileHasAtMostOnePerCardType',
    'caseFileHasAtLeastOnePerCardType',
    'caseFileHasExactlyOnePerCardType',
    'guessIsRefutedByHeldCard',
] as const;

type RawDeductionRule = typeof ALL_DEDUCTION_RULES[number];

export const setupDeductionRules = (
    rules: 'all' | readonly RawDeductionRule[] = 'all',
): E.Either<B.Brand.BrandErrors, DeductionRule.DeductionRule> =>
    pipe(
        // Convert the default list of "all"
        rules,
        rules => typeof rules === 'string'
            ? ALL_DEDUCTION_RULES
            : rules,

        // TODO validate that the strings are actually valid

        // Convert the selected deduction rule IDs to actual functions
        ROA.map(pipe(
            Match.type<RawDeductionRule>(),

            Match.when('cardIsHeldAtMostOnce', () => DeductionRule.cardIsHeldAtMostOnce),
            Match.when('cardIsHeldAtLeastOnce', () => DeductionRule.cardIsHeldAtLeastOnce),
            Match.when('cardIsHeldExactlyOnce', () => DeductionRule.cardIsHeldExactlyOnce),
            Match.when('playerHasAtMostNumCards', () => DeductionRule.playerHasAtMostNumCards),
            Match.when('playerHasAtLeastNumCards', () => DeductionRule.playerHasAtLeastNumCards),
            Match.when('playerHasExactlyNumCards', () => DeductionRule.playerHasExactlyNumCards),
            Match.when('caseFileHasAtMostOnePerCardType', () => DeductionRule.caseFileHasAtMostOnePerCardType),
            Match.when('caseFileHasAtLeastOnePerCardType', () => DeductionRule.caseFileHasAtLeastOnePerCardType),
            Match.when('caseFileHasExactlyOnePerCardType', () => DeductionRule.caseFileHasExactlyOnePerCardType),
            Match.when('guessIsRefutedByHeldCard', () => DeductionRule.guessIsRefutedByHeldCard),

            Match.exhaustive,
        )),

        // Combine them all into a single deduction rule
        DeductionRule.MonoidUnion.combineAll,

        // This operation is always successful
        E.right,
    );

export const deduceConclusions = (
    deductionRule: DeductionRule.DeductionRule,
    {
        maxIterations,
    }: {
        maxIterations?: number,
    } = {
        // Default to no options
    }
) => (
    initialConclusions: ConclusionMapSet.ValidatedConclusionMapSet,
): T.Effect<
    Game.Game | GuessSet.ValidatedGuessSet,
    B.Brand.BrandErrors,
    ConclusionMapSet.ValidatedConclusionMapSet
> =>
    T.gen(function* ($) {
        // Start with the initial conclusions
        let previousConclusions = initialConclusions;
        let newConclusions = initialConclusions;
        let iterationNum = 0;

        do {
            iterationNum++;

            // Add more conclusions recursively, tracking the results of the previous iteration
            previousConclusions = newConclusions;
            newConclusions = yield* $(deductionRule(newConclusions));
        } while (
            // Continue as long as the iteration gave us new results
            !EQ.equals(previousConclusions, newConclusions)

            // Continue forever if no max iterations is provided,
            // or continue as long as we haven't hit that maximum
            && (P.isNullable(maxIterations) || iterationNum < maxIterations)
        );

        return newConclusions;
    });