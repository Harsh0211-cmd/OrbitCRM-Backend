
USE orbitcrm;

CREATE TABLE IF NOT EXISTS pipeline (
    pipeline_id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT NOT NULL,
    deal_name VARCHAR(150) NOT NULL,
    deal_value DECIMAL(12,2) DEFAULT 0.00,
    stage ENUM(
        'PROSPECTING',
        'QUALIFICATION',
        'PROPOSAL',
        'NEGOTIATION',
        'WON',
        'LOST'
    ) DEFAULT 'PROSPECTING',
    expected_close_date DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (lead_id)
        REFERENCES leads(lead_id)
);
