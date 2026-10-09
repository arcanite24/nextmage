package mage.server.websocket.service;

/**
 * Web client bridge: card search filters that {@link mage.cards.repository.CardCriteria} has no field for.
 */
public class WebCardFilters {

    /**
     * Only cards whose color identity fits inside these colors (letters of WUBRG, e.g. "WU"; "" = colorless only).
     * Null means no color identity filter, as for a Commander deck without a commander yet.
     */
    private String colorIdentity;

    public String getColorIdentity() {
        return colorIdentity;
    }

    public WebCardFilters colorIdentity(String colorIdentity) {
        this.colorIdentity = colorIdentity;
        return this;
    }
}
