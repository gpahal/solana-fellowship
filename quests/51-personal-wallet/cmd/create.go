package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

// createCmd represents the create command
var createCmd = &cobra.Command{
	Use:   "createWallet",
	Short: "Create a new wallet",
	Long:  "Create a new wallet and provides wallet address and private key.",

	Args: cobra.NoArgs,

	RunE: func(cmd *cobra.Command, args []string) error {
		wallet, err := createNewWallet(devnetRPCEndpoint)
		if err != nil {
			return err
		}

		fmt.Println("Public Key: " + wallet.account.PublicKey.ToBase58())
		fmt.Println("Private Key Saved in 'data' file")
		return nil
	},
}

func init() {
	rootCmd.AddCommand(createCmd)
}
