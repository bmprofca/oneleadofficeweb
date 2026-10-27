import React from 'react';
import { FiMapPin, FiMessageCircle, FiPhone } from 'react-icons/fi';
import { phoneLink } from '../../utils/crm';

const stop = (e) => e.stopPropagation();

/**
 * Compact Call / WhatsApp / Map buttons. Call opens the device dialer (tel:),
 * Map opens the lead on Google Maps in a new tab. Missing data hides a button.
 */
export default function ContactLinks({ phone, name, map, whatsapp = true, labels = false, className = '' }) {
  const links = phoneLink(phone);
  if (!links && !map) return null;
  const who = name || phone || 'lead';
  return (
    <span className={`contact-links${labels ? ' with-labels' : ''} ${className}`}>
      {links ? (
        <a href={links.tel} className="contact-link is-call" title={`Call ${phone}`} aria-label={`Call ${who}`} onClick={stop}>
          <FiPhone size={13} />
          {labels ? <span>Call</span> : null}
        </a>
      ) : null}
      {links && whatsapp ? (
        <a
          href={links.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="contact-link is-wa"
          title="WhatsApp"
          aria-label={`WhatsApp ${who}`}
          onClick={stop}
        >
          <FiMessageCircle size={13} />
          {labels ? <span>WhatsApp</span> : null}
        </a>
      ) : null}
      {map ? (
        <a
          href={map}
          target="_blank"
          rel="noopener noreferrer"
          className="contact-link is-map"
          title="Open on Google Maps"
          aria-label={`Open ${who} on Google Maps`}
          onClick={stop}
        >
          <FiMapPin size={13} />
          {labels ? <span>Map</span> : null}
        </a>
      ) : null}
    </span>
  );
}
