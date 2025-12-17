if [[ -n "171" ]]; then
    docker exec homerp-db psql -U homerp -c 'CREATE DATABASE homerp_171' || true
fi;

mise trust
mise run setup