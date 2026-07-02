import type React from 'react';
import type { DeckCardInfo } from '../../types';
import type { DeckCardZone } from '../../services';
import './AddLandsResultDetails.css';

export interface AddLandsResultDetailsData {
    totalAdded: number;
    destination: DeckCardZone;
    setCode?: string | null;
    fullArtOnly?: boolean;
    addedCards: DeckCardInfo[];
    unresolvedCardNames: string[];
}

interface AddLandsResultDetailsProps {
    details: AddLandsResultDetailsData;
    className?: string;
}

function normalizeSetCode(setCode: string | null | undefined): string {
    return (setCode ?? '').trim().toUpperCase();
}

function isResolvedPrinting(card: DeckCardInfo, unresolvedCardNames: string[]): boolean {
    if (unresolvedCardNames.includes(card.cardName)) return false;
    return Boolean(card.setCode?.trim() || card.cardNumber?.trim());
}

export const AddLandsResultDetails: React.FC<AddLandsResultDetailsProps> = ({ details, className }) => {
    const normalizedSetCode = normalizeSetCode(details.setCode);
    const classes = ['add-lands-result-details', className].filter(Boolean).join(' ');

    return (
        <section
            className={classes}
            aria-label="Add Lands result"
            data-testid="add-lands-result-details"
            data-total-added={details.totalAdded}
            data-destination={details.destination}
            data-set-code={normalizedSetCode}
            data-full-art-only={details.fullArtOnly ? 'true' : 'false'}
            data-unresolved-count={details.unresolvedCardNames.length}
        >
            <div className="add-lands-result-summary">
                <strong>{details.totalAdded}</strong>
                <span>{details.destination === 'main' ? 'Main deck' : 'Sideboard'}</span>
                <span>{normalizedSetCode || 'Any set'}</span>
                <span>{details.fullArtOnly ? 'Full-art only' : 'Any art'}</span>
            </div>
            <div className="add-lands-result-cards">
                {details.addedCards.map((card, index) => {
                    const resolved = isResolvedPrinting(card, details.unresolvedCardNames);
                    return (
                        <div
                            key={`${card.cardName}-${card.setCode ?? ''}-${card.cardNumber ?? ''}-${index}`}
                            className="add-lands-result-card"
                            data-testid="add-lands-result-card"
                            data-card-name={card.cardName}
                            data-card-amount={card.amount}
                            data-set-code={normalizeSetCode(card.setCode)}
                            data-card-number={card.cardNumber ?? ''}
                            data-resolved={resolved ? 'true' : 'false'}
                        >
                            <strong>{card.amount}x {card.cardName}</strong>
                            <span>{resolved ? [normalizeSetCode(card.setCode), card.cardNumber].filter(Boolean).join(' #') : 'Fallback printing'}</span>
                        </div>
                    );
                })}
            </div>
            {details.unresolvedCardNames.length > 0 && (
                <div className="add-lands-result-unresolved" data-testid="add-lands-result-unresolved">
                    {details.unresolvedCardNames.map(cardName => (
                        <span key={cardName} data-testid="add-lands-result-unresolved-name">{cardName}</span>
                    ))}
                </div>
            )}
        </section>
    );
};
