{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell{
  packages = [
    pkgs.nodejs
  ];
  shellHook = ''
    export SHELL=$(which zsh)
    nvim && exit
  '';
}
