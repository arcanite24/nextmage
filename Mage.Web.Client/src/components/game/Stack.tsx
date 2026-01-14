import React from 'react';
import { CardsView } from '../../types';
import './GamePage.css';

interface StackProps {
    stack: CardsView;
}

export const Stack: React.FC<StackProps> = ({ stack }) => {
    const stackItems = stack ? Object.values(stack) : [];

    if (stackItems.length === 0) {
        return <div className="stack-empty">Stack Empty</div>;
    }

    return (
        <div className="stack-list">
            <h4>Stack ({stackItems.length})</h4>
            <div className="stack-cards">
                {stackItems.map(card => (
                    <div key={card.id} className="stack-card">
                        <div className="stack-card-name">{card.name}</div>
                        {/* Short info if needed */}
                        <div className="stack-card-type">{card.cardTypes.join(' ')}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};
