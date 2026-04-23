import { useEffect, useState } from 'react';
import { fetchSubjects, fetchSubject, fetchCorrelatedSubjects } from '../lib/oracle.js';

export function useSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchSubjects().then((list) => {
      if (cancelled) return;
      setSubjects(list || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { subjects, loading };
}

export function useSubject(slug) {
  const [subject, setSubject] = useState(null);
  const [correlated, setCorrelated] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!slug) { setLoading(false); return; }
    setLoading(true);
    Promise.all([fetchSubject(slug), fetchCorrelatedSubjects(slug)]).then(([s, c]) => {
      if (cancelled) return;
      setSubject(s);
      setCorrelated(c || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug]);

  return { subject, correlated, loading };
}
