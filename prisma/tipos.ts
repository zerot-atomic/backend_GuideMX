// [nombre, estado, municipio, latitud, longitud, categorías, descripción corta, relevancia]
// Categorías: H=Histórico, A=Arqueológico, C=Cultural, N=Natural, R=Religioso, G=Gastronomía, S=Hospedaje
// Las coordenadas son aproximadas: conviene revisarlas en un mapa antes de publicar.
export type Lugar = [string, string, string, number, number, string, string, number];
