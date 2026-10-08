package mage.server.websocket.service;

import mage.cards.decks.CommanderBrackets;
import mage.cards.decks.Deck;
import mage.cards.decks.DeckCardLists;
import mage.cards.decks.DeckValidator;
import mage.cards.decks.DeckValidatorError;
import mage.cards.decks.DeckValidatorFactory;
import mage.server.websocket.rpc.RpcException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Web client bridge: deck legality for one format, plus EDH power level and Commander brackets.
 */
public final class DeckValidationService {

    public DeckValidationResult validate(String deckType, DeckCardLists deckCardLists) throws Exception {
        DeckValidator validator = DeckValidatorFactory.instance.createDeckValidator(deckType);
        if (validator == null) {
            throw RpcException.invalidParams("Unknown deck type: " + deckType);
        }
        Deck deck = Deck.load(deckCardLists, false, false);
        boolean valid = validator.validate(deck);
        return new DeckValidationResult(deckType, validator, deck, valid);
    }

    public static final class DeckValidationResult {
        private final String deckType;
        private final String name;
        private final String shortName;
        private final boolean valid;
        private final boolean partlyValid;
        private final List<ErrorInfo> errors;
        private final int edhPowerLevel;
        private final List<String> edhPowerCards = new ArrayList<>();
        private final List<String> edhPowerDetails = new ArrayList<>();
        private final List<BracketInfo> commanderBrackets = new ArrayList<>();

        private DeckValidationResult(String deckType, DeckValidator validator, Deck deck, boolean valid) {
            this.deckType = deckType;
            this.name = validator.getName();
            this.shortName = validator.getShortName();
            this.valid = valid;
            this.partlyValid = validator.isPartlyValid();
            this.errors = validator.getErrorsListSorted().stream().map(ErrorInfo::new).collect(Collectors.toList());
            this.edhPowerLevel = validator.getEdhPowerLevel(deck, this.edhPowerCards, this.edhPowerDetails);

            CommanderBrackets.Analysis analysis = CommanderBrackets.analyze(deck);
            for (int level = 1; level <= CommanderBrackets.MAX_LEVEL; level++) {
                this.commanderBrackets.add(new BracketInfo(level, analysis));
            }
        }
    }

    private static final class ErrorInfo {
        private final String type;
        private final String group;
        private final String message;
        private final String cardName;

        private ErrorInfo(DeckValidatorError error) {
            this.type = error.getErrorType().name();
            this.group = error.getGroup();
            this.message = error.getMessage();
            this.cardName = error.getCardName();
        }
    }

    private static final class BracketInfo {
        private final int level;
        private final String name;
        private final String shortName;
        private final boolean valid;
        private final List<String> badCards;
        private final List<BracketGroupInfo> groups = new ArrayList<>();

        private BracketInfo(int level, CommanderBrackets.Analysis analysis) {
            this.level = level;
            this.name = "Bracket " + level;
            this.shortName = "B" + level;
            this.badCards = analysis.getBadCards(level);
            this.valid = this.badCards.isEmpty();
            for (Map.Entry<String, List<String>> group : analysis.getGroups().entrySet()) {
                this.groups.add(new BracketGroupInfo(group.getKey(), group.getValue(),
                        CommanderBrackets.getMaxCards(group.getKey(), level)));
            }
        }
    }

    private static final class BracketGroupInfo {
        private final String name;
        private final int count;
        private final int max;
        private final List<String> cards;

        private BracketGroupInfo(String name, List<String> cards, int max) {
            this.name = name;
            this.count = cards.size();
            this.max = max;
            this.cards = cards;
        }
    }
}
