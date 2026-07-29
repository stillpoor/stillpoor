import type {
  BlockCoordinate,
} from "../board/boardTypes";

export interface ActiveBlockReservation {
  coordinate:
    BlockCoordinate;

  expiresAt:
    string;
}

type ReservationListener =
  () => void;

const reservations =
  new Map<
    string,
    ActiveBlockReservation
  >();

const listeners =
  new Set<
    ReservationListener
  >();

function getReservationKey(
  coordinate:
    BlockCoordinate,
) {
  return `${coordinate.row}:${coordinate.column}`;
}

function notifyListeners() {
  listeners.forEach(
    (listener) => {
      listener();
    },
  );
}

export function getActiveBlockReservations() {
  return reservations.values();
}

export function isBlockReserved(
  coordinate:
    BlockCoordinate,
) {
  const reservation =
    reservations.get(
      getReservationKey(
        coordinate,
      ),
    );

  if (!reservation) {
    return false;
  }

  return (
    new Date(
      reservation.expiresAt,
    ).getTime() >
    Date.now()
  );
}

export function replaceActiveBlockReservations(
  nextReservations:
    readonly ActiveBlockReservation[],
) {
  reservations.clear();

  const now =
    Date.now();

  nextReservations.forEach(
    (reservation) => {
      const expiresAt =
        new Date(
          reservation.expiresAt,
        ).getTime();

      if (
        !Number.isFinite(
          expiresAt,
        ) ||
        expiresAt <= now
      ) {
        return;
      }

      reservations.set(
        getReservationKey(
          reservation.coordinate,
        ),
        {
          coordinate: {
            ...reservation.coordinate,
          },

          expiresAt:
            reservation.expiresAt,
        },
      );
    },
  );

  notifyListeners();
}

export function removeExpiredBlockReservations() {
  const now =
    Date.now();

  let hasChanged =
    false;

  reservations.forEach(
    (
      reservation,
      key,
    ) => {
      const expiresAt =
        new Date(
          reservation.expiresAt,
        ).getTime();

      if (
        expiresAt > now
      ) {
        return;
      }

      reservations.delete(
        key,
      );

      hasChanged =
        true;
    },
  );

  if (hasChanged) {
    notifyListeners();
  }

  return hasChanged;
}

export function subscribeToBlockReservations(
  listener:
    ReservationListener,
) {
  listeners.add(
    listener,
  );

  return () => {
    listeners.delete(
      listener,
    );
  };
}